-- Transformation R4 (ADR 0003): the request marketplace.
--
-- * Allocation per business (booking_policies.allocation_mode):
--     manual        — the front desk reviews every request (R3 behaviour);
--     open          — requests go straight to eligible groomers' shift board;
--     automatic     — the system books the first capable, available groomer at a
--                     requested time, falling back to the shift board;
--     assigned_only — the front desk assigns each request to one groomer, who accepts.
-- * accept_booking_request() lets one groomer win: the request row is locked,
--   status, deadline, assignment, capability, working hours and the existing
--   no-overlap constraint are all checked in one transaction. A second groomer
--   gets 'no_longer_available'.
-- * Unclaimed requests return to the front desk at their deadline; requests
--   whose time has passed expire. Housekeeping is idempotent and runs when the
--   relevant pages load (no scheduler needed).
-- * In-app notifications (one table, per person) with dedupe keys; email and
--   SMS can be added later as delivery channels without changing callers.

create type public.allocation_mode as enum ('manual', 'open', 'automatic', 'assigned_only');
alter table public.booking_policies
  add column allocation_mode public.allocation_mode not null default 'manual',
  add column accept_hours integer not null default 24 check (accept_hours between 1 and 336),
  add column groomer_commission_percent smallint check (groomer_commission_percent is null or groomer_commission_percent between 0 and 100),
  add column groomers_set_own_hours boolean not null default false;

-- Which services each groomer may do. A groomer with no rows may do every service.
create table public.member_services (
  business_id uuid not null references public.businesses on delete cascade,
  member_id   uuid not null,
  service_id  uuid not null,
  created_at  timestamptz not null default now(),
  primary key (member_id, service_id),
  foreign key (member_id, business_id) references public.business_members (id, business_id) on delete cascade,
  foreign key (service_id, business_id) references public.services (id, business_id) on delete cascade
);
create index member_services_business_idx on public.member_services (business_id);
create index member_services_service_idx on public.member_services (service_id);
alter table public.member_services enable row level security;
create policy member_services_select on public.member_services for select to authenticated using (public.is_business_member(business_id));
create policy member_services_write on public.member_services for all to authenticated
  using (public.has_business_role(business_id, array['owner','manager']::public.business_role[]))
  with check (public.has_business_role(business_id, array['owner','manager']::public.business_role[]));
revoke all on public.member_services from anon;
grant select, insert, delete on public.member_services to authenticated;

alter table public.booking_requests
  add column assigned_groomer_id uuid,
  add column accepted_by uuid,
  add column accepted_at timestamptz,
  add constraint booking_requests_assigned_fkey foreign key (assigned_groomer_id, business_id) references public.business_members (id, business_id),
  add constraint booking_requests_accepted_fkey foreign key (accepted_by, business_id) references public.business_members (id, business_id);
create index booking_requests_assigned_idx on public.booking_requests (assigned_groomer_id) where assigned_groomer_id is not null;
create index booking_requests_accepted_idx on public.booking_requests (accepted_by) where accepted_by is not null;
create index booking_requests_open_idx on public.booking_requests (business_id, accept_deadline) where status = 'open';

-- ---------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------
create table public.notifications (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users on delete cascade,
  business_id uuid references public.businesses on delete cascade,
  audience    text not null check (audience in ('customer', 'staff')),
  kind        text not null check (char_length(kind) <= 40),
  data        jsonb not null default '{}'::jsonb,
  dedupe_key  text not null check (char_length(dedupe_key) <= 200),
  read_at     timestamptz,
  created_at  timestamptz not null default now(),
  unique (user_id, kind, dedupe_key)
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_business_idx on public.notifications (business_id);
alter table public.notifications enable row level security;
create policy notifications_own_select on public.notifications for select to authenticated using (user_id = (select auth.uid()));
create policy notifications_own_update on public.notifications for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.notifications from anon;
revoke insert, update, delete on public.notifications from authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

create or replace function public.notify(p_user uuid, p_business uuid, p_audience text, p_kind text, p_data jsonb, p_dedupe text)
returns void language sql security definer set search_path = '' as $$
  insert into public.notifications (user_id, business_id, audience, kind, data, dedupe_key)
  select p_user, p_business, p_audience, p_kind, coalesce(p_data, '{}'::jsonb), coalesce(p_dedupe, gen_random_uuid()::text)
  where p_user is not null
  on conflict (user_id, kind, dedupe_key) do nothing;
$$;
create or replace function public.notify_front_desk(p_business uuid, p_kind text, p_data jsonb, p_dedupe text)
returns void language sql security definer set search_path = '' as $$
  select public.notify(m.user_id, p_business, 'staff', p_kind, p_data, p_dedupe)
  from public.business_members m
  where m.business_id = p_business and m.status = 'active' and m.role in ('owner', 'manager', 'receptionist');
$$;
revoke all on function public.notify(uuid, uuid, text, text, jsonb, text), public.notify_front_desk(uuid, text, jsonb, text) from public, anon, authenticated;

-- What a notification needs to read well ("Biscuit's appointment has been accepted by Alex"); no contact details.
create or replace function public.request_payload(p_request uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('requestId', r.id, 'businessName', b.name, 'businessSlug', b.slug, 'timezone', b.timezone, 'petName', p.name,
    'startsAt', coalesce(a.starts_at, r.preferred_start), 'groomerName', m.display_name, 'appointmentId', r.appointment_id,
    'services', (select coalesce(jsonb_agg(s.name order by s.position), '[]') from public.booking_request_services s where s.request_id = r.id))
  from public.booking_requests r join public.businesses b on b.id = r.business_id join public.pets p on p.id = r.pet_id
  left join public.appointments a on a.id = r.appointment_id
  left join public.business_members m on m.id = coalesce(a.groomer_id, r.accepted_by, r.assigned_groomer_id)
  where r.id = p_request;
$$;
revoke all on function public.request_payload(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Capability, routing and automatic allocation
-- ---------------------------------------------------------------------
create or replace function public.groomer_can_do(p_member uuid, p_request uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select not exists (select 1 from public.member_services where member_id = p_member)
      or not exists (
        select 1 from public.booking_request_services s
        where s.request_id = p_request and s.service_id is not null
          and not exists (select 1 from public.member_services ms where ms.member_id = p_member and ms.service_id = s.service_id));
$$;
revoke all on function public.groomer_can_do(uuid, uuid) from public, anon, authenticated;

-- Groomers who may take a request: active, grooming roles, capable, and the assigned one if there is one.
create or replace function public.eligible_groomers(p_request uuid)
returns setof public.business_members language sql stable security definer set search_path = '' as $$
  select m.* from public.business_members m join public.booking_requests r on r.business_id = m.business_id
  where r.id = p_request and m.status = 'active' and m.role in ('owner', 'manager', 'groomer')
    and (r.assigned_groomer_id is null or m.id = r.assigned_groomer_id)
    and public.groomer_can_do(m.id, p_request);
$$;
revoke all on function public.eligible_groomers(uuid) from public, anon, authenticated;

-- Start times a request allows: the preferred time, or 30-minute steps inside each flexible window (local time).
create or replace function public.request_candidate_starts(p_request uuid)
returns setof timestamptz language sql stable security definer set search_path = '' as $$
  with r as (select br.*, coalesce(l.timezone, b.timezone) as tz from public.booking_requests br join public.businesses b on b.id = br.business_id join public.locations l on l.id = br.location_id where br.id = p_request)
  select r.preferred_start from r where r.preferred_start is not null
  union all
  select ((w->>'date')::date + make_interval(mins => m)) at time zone r.tz
  from r, jsonb_array_elements(r.windows) w,
       generate_series(case w->>'part' when 'afternoon' then 720 else 420 end, case w->>'part' when 'morning' then 690 else 1170 end, 30) m
  where r.preferred_start is null
  order by 1;
$$;
revoke all on function public.request_candidate_starts(uuid) from public, anon, authenticated;

-- Books the first capable, available groomer at an allowed time (fewest appointments that day first). Null when none fits.
create or replace function public.auto_allocate(p_request uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare r record; st timestamptz; m record; appt uuid;
begin
  select * into r from public.booking_requests where id = p_request for update;
  for st in select s from public.request_candidate_starts(p_request) s where s > now() + interval '1 hour' loop
    for m in select g.* from public.eligible_groomers(p_request) g
             order by (select count(*) from public.appointments a where a.groomer_id = g.id and a.status not in ('cancelled', 'no_show') and a.starts_at::date = st::date), g.created_at loop
      continue when not public.slot_fits_hours(r.location_id, m.id, st, st + make_interval(mins => r.block_minutes));
      begin
        insert into public.appointments (business_id, location_id, customer_id, pet_id, groomer_id, starts_at, service_ends_at, ends_at, status, source, customer_notes, price_estimate_cents, price_from)
        values (r.business_id, r.location_id, r.customer_id, r.pet_id, m.id, st, st + make_interval(mins => r.estimate_minutes), st + make_interval(mins => r.block_minutes), 'confirmed', 'online', r.notes, r.estimate_cents, r.estimate_from)
        returning id into appt;
      exception when exclusion_violation then
        continue;
      end;
      insert into public.appointment_services (business_id, appointment_id, service_id, name, duration_minutes, price_cents, position)
      select business_id, appt, service_id, name, duration_minutes, price_cents, position from public.booking_request_services where request_id = p_request;
      update public.booking_requests set status = 'confirmed', appointment_id = appt, accepted_by = m.id, accepted_at = now(), assigned_groomer_id = m.id where id = p_request;
      return appt;
    end loop;
  end loop;
  return null;
end;
$$;
revoke all on function public.auto_allocate(uuid) from public, anon, authenticated;

-- Deadline for groomers to accept: the policy's hours, but never later than an hour before the requested time.
create or replace function public.accept_deadline_for(p_request uuid, p_hours integer)
returns timestamptz language sql stable security definer set search_path = '' as $$
  select least(now() + make_interval(hours => greatest(1, p_hours)), coalesce((select min(s) from public.request_candidate_starts(p_request) s) - interval '1 hour', now() + make_interval(hours => greatest(1, p_hours))));
$$;
revoke all on function public.accept_deadline_for(uuid, integer) from public, anon, authenticated;

create or replace function public.notify_open_request(p_request uuid)
returns void language sql security definer set search_path = '' as $$
  select public.notify(g.user_id, g.business_id, 'staff', case when (select assigned_groomer_id from public.booking_requests where id = p_request) is null then 'request_open' else 'request_assigned' end, public.request_payload(p_request), p_request::text)
  from public.eligible_groomers(p_request) g where g.role = 'groomer' or (select assigned_groomer_id from public.booking_requests where id = p_request) = g.id;
$$;
revoke all on function public.notify_open_request(uuid) from public, anon, authenticated;

-- Where a new request goes, by the business's allocation mode.
create or replace function public.route_new_request(p_request uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare r record; pol record; mode public.allocation_mode; appt uuid;
begin
  select * into r from public.booking_requests where id = p_request;
  select * into pol from public.booking_policies where business_id = r.business_id;
  mode := coalesce(pol.allocation_mode, 'manual');
  if mode = 'automatic' then
    appt := public.auto_allocate(p_request);
    if appt is not null then
      perform public.log_request_event(p_request, r.business_id, 'submitted', 'accepted', 'Matched automatically');
      perform public.log_request_event(p_request, r.business_id, 'accepted', 'confirmed', null);
      perform public.notify(r.requester_id, r.business_id, 'customer', 'request_confirmed', public.request_payload(p_request), p_request::text);
      perform public.notify_front_desk(r.business_id, 'request_accepted', public.request_payload(p_request), p_request::text);
      return;
    end if;
  end if;
  if mode in ('open', 'automatic') then
    update public.booking_requests set status = 'open', accept_deadline = public.accept_deadline_for(p_request, coalesce(pol.accept_hours, 24)) where id = p_request;
    perform public.log_request_event(p_request, r.business_id, 'submitted', 'open', null);
    perform public.notify_open_request(p_request);
  else
    update public.booking_requests set status = 'awaiting_review' where id = p_request;
    perform public.log_request_event(p_request, r.business_id, 'submitted', 'awaiting_review', null);
  end if;
  perform public.notify_front_desk(r.business_id, 'request_new', public.request_payload(p_request), p_request::text);
end;
$$;
revoke all on function public.route_new_request(uuid) from public, anon, authenticated;

-- R3 request functions, now routed by allocation mode and sending notifications.
create or replace function public.submit_booking_request(p_slug text, p_owner_pet uuid, p_service_ids uuid[], p_preferred_start timestamptz, p_windows jsonb, p_notes text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid(); mail text; full_name text;
  b record; mp record; op record; loc uuid; cust uuid; pet uuid; req uuid;
  svc record; total_min int := 0; total_block int := 0; total_cents int := 0; any_from boolean := false; pos int := 0;
  w jsonb; n_svc int;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select u.email, coalesce(nullif(trim(pr.full_name), ''), split_part(u.email, '@', 1)) into mail, full_name
  from auth.users u left join public.profiles pr on pr.id = u.id where u.id = uid and u.email_confirmed_at is not null;
  if mail is null then raise exception 'email_unverified' using errcode = '28000'; end if;
  select id, timezone into b from public.businesses where slug = lower(btrim(p_slug)) and status = 'active';
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  select * into mp from public.marketplace_profiles where business_id = b.id and listed;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if not mp.accepting_requests then raise exception 'not_accepting' using errcode = '22023'; end if;
  select * into op from public.owner_pets where id = p_owner_pet and user_id = uid;
  if not found then raise exception 'invalid_pet' using errcode = '22023'; end if;
  if p_notes is not null and char_length(p_notes) > 1000 then raise exception 'invalid_notes' using errcode = '22023'; end if;
  if p_preferred_start is null and (p_windows is null or jsonb_typeof(p_windows) <> 'array' or jsonb_array_length(p_windows) = 0) then raise exception 'invalid_time' using errcode = '22023'; end if;
  if p_preferred_start is not null and (p_preferred_start < now() + interval '1 hour' or p_preferred_start > now() + interval '90 days') then raise exception 'invalid_time' using errcode = '22023'; end if;
  if p_windows is not null and jsonb_typeof(p_windows) = 'array' then
    if jsonb_array_length(p_windows) > 3 then raise exception 'invalid_time' using errcode = '22023'; end if;
    for w in select * from jsonb_array_elements(p_windows) loop
      if not (w ? 'date' and w ? 'part') or (w->>'part') not in ('morning', 'afternoon', 'any') or (w->>'date') !~ '^\d{4}-\d{2}-\d{2}$'
         or (w->>'date')::date < (now() at time zone b.timezone)::date or (w->>'date')::date > (now() at time zone b.timezone)::date + 90 then
        raise exception 'invalid_time' using errcode = '22023';
      end if;
    end loop;
  end if;
  n_svc := coalesce(array_length(p_service_ids, 1), 0);
  if n_svc = 0 or n_svc > 6 or (select count(*) from public.services where id = any(p_service_ids) and business_id = b.id and active and bookable_online) <> (select count(distinct x) from unnest(p_service_ids) x) then
    raise exception 'invalid_services' using errcode = '22023';
  end if;
  -- Fair use: at most 3 open requests per business and 10 new requests a day per person.
  if (select count(*) from public.booking_requests where requester_id = uid and business_id = b.id and status in ('submitted', 'awaiting_review', 'open', 'accepted')) >= 3
     or (select count(*) from public.booking_requests where requester_id = uid and created_at > now() - interval '1 day') >= 10 then
    raise exception 'rate_limited' using errcode = '22023';
  end if;
  select id into loc from public.locations where business_id = b.id and archived_at is null and not is_mobile order by created_at limit 1;
  if loc is null then raise exception 'not_accepting' using errcode = '22023'; end if;

  -- Customer: already linked, else an unlinked record with this verified email, else a new one.
  select id into cust from public.customers where business_id = b.id and account_user_id = uid;
  if cust is null then
    select c.id into cust from public.customers c join public.customer_contacts cc on cc.customer_id = c.id
    where c.business_id = b.id and c.account_user_id is null and c.archived_at is null and lower(cc.email::text) = lower(mail) order by c.created_at limit 1;
    if cust is not null then update public.customers set account_user_id = uid where id = cust; end if;
  end if;
  if cust is null then
    insert into public.customers (business_id, first_name, last_name, preferred_contact, account_user_id, created_by)
    values (b.id, split_part(full_name, ' ', 1), nullif(substr(full_name, char_length(split_part(full_name, ' ', 1)) + 2), ''), 'email', uid, uid) returning id into cust;
    insert into public.customer_contacts (customer_id, business_id, email) values (cust, b.id, mail);
  end if;
  -- Business pet linked to the owner's profile.
  select id into pet from public.pets where business_id = b.id and owner_pet_id = op.id;
  if pet is null then
    select id into pet from public.pets where business_id = b.id and customer_id = cust and owner_pet_id is null and lower(name) = lower(op.name) and archived_at is null limit 1;
    if pet is not null then update public.pets set owner_pet_id = op.id, owner_notes = public.owner_notes_text(op.grooming_preferences, op.care_notes) where id = pet; end if;
  end if;
  if pet is null then
    insert into public.pets (business_id, customer_id, name, species, breed, size, date_of_birth, estimated_age_years, weight_kg, coat_type, owner_pet_id, owner_notes)
    values (b.id, cust, op.name, op.species, op.breed, op.size, op.date_of_birth, op.estimated_age_years, op.weight_kg, op.coat_type, op.id, public.owner_notes_text(op.grooming_preferences, op.care_notes)) returning id into pet;
  end if;
  if (select customer_id from public.pets where id = pet) <> cust then raise exception 'invalid_pet' using errcode = '22023'; end if;

  insert into public.booking_requests (business_id, requester_id, customer_id, pet_id, location_id, status, preferred_start, windows, notes, estimate_minutes, block_minutes)
  values (b.id, uid, cust, pet, loc, 'submitted', p_preferred_start, coalesce(p_windows, '[]'::jsonb), nullif(btrim(p_notes), ''), 5, 5) returning id into req;
  for svc in select s.* from unnest(p_service_ids) with ordinality u(id, ord) join public.services s on s.id = u.id order by u.ord loop
    insert into public.booking_request_services (business_id, request_id, service_id, name, duration_minutes, price_cents, position)
    values (b.id, req, svc.id, svc.name, svc.duration_minutes, public.service_price_for(svc.id, op.breed, op.size::text), pos);
    pos := pos + 1;
    total_min := total_min + svc.duration_minutes;
    total_block := total_block + svc.duration_minutes;
    total_cents := total_cents + public.service_price_for(svc.id, op.breed, op.size::text);
    any_from := any_from or svc.price_from;
  end loop;
  total_block := total_block + (select coalesce(max(buffer_minutes), 0) from public.services where id = any(p_service_ids));
  update public.booking_requests set estimate_minutes = total_min, block_minutes = total_block, estimate_cents = total_cents, estimate_from = any_from where id = req;
  perform public.log_request_event(req, b.id, null, 'submitted', null);
  perform public.route_new_request(req);
  return req;
end;
$$;

create or replace function public.review_booking_request(p_id uuid, p_action text, p_groomer uuid, p_starts_at timestamptz, p_reason text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare r record; appt uuid; ends timestamptz; svc_end timestamptz;
begin
  select * into r from public.booking_requests where id = p_id for update;
  if not found or not public.has_business_role(r.business_id, array['owner','manager','receptionist']::public.business_role[]) then raise exception 'not_found' using errcode = 'P0002'; end if;
  if r.status not in ('awaiting_review', 'open') then raise exception 'no_longer_available' using errcode = '22023'; end if;
  if p_action = 'reject' then
    update public.booking_requests set status = 'rejected', decided_by = auth.uid(), decided_at = now(), decision_reason = nullif(btrim(left(p_reason, 500)), '') where id = p_id;
    perform public.log_request_event(p_id, r.business_id, r.status, 'rejected', nullif(btrim(left(p_reason, 500)), ''));
    perform public.notify(r.requester_id, r.business_id, 'customer', 'request_rejected', public.request_payload(p_id), p_id::text);
    return null;
  end if;
  if p_action <> 'confirm' or p_groomer is null or p_starts_at is null then raise exception 'invalid_action' using errcode = '22023'; end if;
  if p_starts_at < now() then raise exception 'outside_window' using errcode = '22023'; end if;
  if not exists (select 1 from public.business_members where id = p_groomer and business_id = r.business_id and status = 'active') then raise exception 'invalid_groomer' using errcode = '22023'; end if;
  svc_end := p_starts_at + make_interval(mins => r.estimate_minutes);
  ends := p_starts_at + make_interval(mins => r.block_minutes);
  if not public.slot_fits_hours(r.location_id, p_groomer, p_starts_at, ends) then raise exception 'outside_hours' using errcode = '22023'; end if;
  begin
    insert into public.appointments (business_id, location_id, customer_id, pet_id, groomer_id, starts_at, service_ends_at, ends_at, status, source, customer_notes, price_estimate_cents, price_from, created_by)
    values (r.business_id, r.location_id, r.customer_id, r.pet_id, p_groomer, p_starts_at, svc_end, ends, 'confirmed', 'online', r.notes, r.estimate_cents, r.estimate_from, auth.uid())
    returning id into appt;
  exception when exclusion_violation then
    raise exception 'slot_unavailable' using errcode = '23P01';
  end;
  insert into public.appointment_services (business_id, appointment_id, service_id, name, duration_minutes, price_cents, position)
  select business_id, appt, service_id, name, duration_minutes, price_cents, position from public.booking_request_services where request_id = p_id;
  update public.booking_requests set status = 'confirmed', appointment_id = appt, decided_by = auth.uid(), decided_at = now(), assigned_groomer_id = p_groomer, accept_deadline = null where id = p_id;
  perform public.log_request_event(p_id, r.business_id, r.status, 'confirmed', null);
  perform public.notify(r.requester_id, r.business_id, 'customer', 'request_confirmed', public.request_payload(p_id), p_id::text);
  return appt;
end;
$$;

create or replace function public.cancel_booking_request(p_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare r record; a record; hours int;
begin
  select * into r from public.booking_requests where id = p_id and requester_id = auth.uid() for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if r.status not in ('submitted', 'awaiting_review', 'open', 'accepted', 'confirmed') then raise exception 'too_late' using errcode = '22023'; end if;
  if r.appointment_id is not null then
    select * into a from public.appointments where id = r.appointment_id for update;
    select coalesce(cancellation_hours, 0) into hours from public.booking_policies where business_id = r.business_id;
    if a.starts_at - make_interval(hours => coalesce(hours, 0)) < now() then raise exception 'too_late' using errcode = '22023'; end if;
    update public.appointments set status = 'cancelled', cancelled_at = now(), cancelled_by = 'customer', cancellation_reason = nullif(btrim(left(p_reason, 500)), '') where id = a.id;
  end if;
  update public.booking_requests set status = 'cancelled', decision_reason = nullif(btrim(left(p_reason, 500)), '') where id = p_id;
  perform public.log_request_event(p_id, r.business_id, r.status, 'cancelled', 'Cancelled by the customer');
  perform public.notify_front_desk(r.business_id, 'request_cancelled', public.request_payload(p_id), p_id::text);
end;
$$;

create or replace function public.mirror_appointment_on_request()
returns trigger language plpgsql security definer set search_path = '' as $$
declare r record; next_status public.booking_request_status;
begin
  if new.status = old.status then return new; end if;
  select * into r from public.booking_requests where appointment_id = new.id;
  if not found then return new; end if;
  next_status := case new.status when 'checked_in' then 'in_progress' when 'in_progress' then 'in_progress' when 'completed' then 'completed' when 'cancelled' then 'cancelled' when 'no_show' then 'cancelled' else r.status end;
  if next_status <> r.status then
    update public.booking_requests set status = next_status where id = r.id;
    insert into public.booking_request_events (business_id, request_id, actor_id, from_status, to_status, note) values (r.business_id, r.id, auth.uid(), r.status, next_status, null);
    perform public.notify(r.requester_id, r.business_id, 'customer',
      case next_status when 'in_progress' then 'grooming_started' when 'completed' then 'grooming_completed' else 'request_cancelled_by_salon' end,
      public.request_payload(r.id), r.id::text);
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Front desk: open to groomers (optionally one), or take back
-- ---------------------------------------------------------------------
create or replace function public.open_booking_request(p_id uuid, p_groomer uuid, p_hours integer)
returns void language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  select * into r from public.booking_requests where id = p_id for update;
  if not found or not public.has_business_role(r.business_id, array['owner','manager','receptionist']::public.business_role[]) then raise exception 'not_found' using errcode = 'P0002'; end if;
  if r.status not in ('awaiting_review', 'open') then raise exception 'no_longer_available' using errcode = '22023'; end if;
  if p_groomer is not null and not exists (select 1 from public.business_members where id = p_groomer and business_id = r.business_id and status = 'active' and role in ('owner', 'manager', 'groomer')) then raise exception 'invalid_groomer' using errcode = '22023'; end if;
  update public.booking_requests set status = 'open', assigned_groomer_id = p_groomer, accept_deadline = public.accept_deadline_for(p_id, coalesce(p_hours, 24)) where id = p_id;
  if p_groomer is not null and not public.groomer_can_do(p_groomer, p_id) then raise exception 'not_capable' using errcode = '22023'; end if;
  perform public.log_request_event(p_id, r.business_id, r.status, 'open', case when p_groomer is null then 'Opened to groomers' else 'Assigned to one groomer' end);
  perform public.notify_open_request(p_id);
end;
$$;

create or replace function public.close_booking_request(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  select * into r from public.booking_requests where id = p_id for update;
  if not found or not public.has_business_role(r.business_id, array['owner','manager','receptionist']::public.business_role[]) then raise exception 'not_found' using errcode = 'P0002'; end if;
  if r.status <> 'open' then raise exception 'no_longer_available' using errcode = '22023'; end if;
  update public.booking_requests set status = 'awaiting_review', assigned_groomer_id = null, accept_deadline = null where id = p_id;
  perform public.log_request_event(p_id, r.business_id, 'open', 'awaiting_review', 'Taken back by the front desk');
end;
$$;

-- ---------------------------------------------------------------------
-- A groomer accepts (one winner)
-- ---------------------------------------------------------------------
create or replace function public.accept_booking_request(p_id uuid, p_starts_at timestamptz)
returns uuid language plpgsql security definer set search_path = '' as $$
declare r record; me record; st timestamptz; appt uuid;
begin
  select m.* into me from public.business_members m join public.booking_requests br on br.business_id = m.business_id
  where br.id = p_id and m.user_id = auth.uid() and m.status = 'active' and m.role in ('owner', 'manager', 'groomer');
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  -- The row lock makes simultaneous accepts queue; the second one sees the new status below.
  select * into r from public.booking_requests where id = p_id for update;
  if r.status <> 'open' or (r.accept_deadline is not null and r.accept_deadline < now()) then raise exception 'no_longer_available' using errcode = '22023'; end if;
  if r.assigned_groomer_id is not null and r.assigned_groomer_id <> me.id then raise exception 'not_assigned' using errcode = '22023'; end if;
  if not public.groomer_can_do(me.id, p_id) then raise exception 'not_capable' using errcode = '22023'; end if;
  st := coalesce(r.preferred_start, p_starts_at);
  if st is null or (r.preferred_start is null and not exists (select 1 from public.request_candidate_starts(p_id) s where s = p_starts_at)) then raise exception 'outside_window' using errcode = '22023'; end if;
  if st < now() then raise exception 'outside_window' using errcode = '22023'; end if;
  if not public.slot_fits_hours(r.location_id, me.id, st, st + make_interval(mins => r.block_minutes)) then raise exception 'outside_hours' using errcode = '22023'; end if;
  begin
    insert into public.appointments (business_id, location_id, customer_id, pet_id, groomer_id, starts_at, service_ends_at, ends_at, status, source, customer_notes, price_estimate_cents, price_from, created_by)
    values (r.business_id, r.location_id, r.customer_id, r.pet_id, me.id, st, st + make_interval(mins => r.estimate_minutes), st + make_interval(mins => r.block_minutes), 'confirmed', 'online', r.notes, r.estimate_cents, r.estimate_from, auth.uid())
    returning id into appt;
  exception when exclusion_violation then
    raise exception 'slot_unavailable' using errcode = '23P01';
  end;
  insert into public.appointment_services (business_id, appointment_id, service_id, name, duration_minutes, price_cents, position)
  select business_id, appt, service_id, name, duration_minutes, price_cents, position from public.booking_request_services where request_id = p_id;
  update public.booking_requests set status = 'confirmed', appointment_id = appt, accepted_by = me.id, accepted_at = now(), assigned_groomer_id = me.id, accept_deadline = null where id = p_id;
  perform public.log_request_event(p_id, r.business_id, 'open', 'accepted', null);
  perform public.log_request_event(p_id, r.business_id, 'accepted', 'confirmed', null);
  perform public.notify(r.requester_id, r.business_id, 'customer', 'request_confirmed', public.request_payload(p_id), p_id::text);
  perform public.notify_front_desk(r.business_id, 'request_accepted', public.request_payload(p_id), p_id::text);
  return appt;
end;
$$;

-- What a groomer sees on the shift board: open requests they may take (pet care details, no contact details).
create or replace function public.shift_board(p_business uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare me record; pol record;
begin
  select * into me from public.business_members where business_id = p_business and user_id = auth.uid() and status = 'active';
  if not found then return '[]'::jsonb; end if;
  select * into pol from public.booking_policies where business_id = p_business;
  return (select coalesce(jsonb_agg(jsonb_build_object(
      'id', r.id, 'petName', p.name, 'species', p.species, 'breed', p.breed, 'size', p.size, 'petId', p.id, 'photoPath', coalesce(p.photo_path, op.photo_path), 'photoBucket', case when p.photo_path is not null then 'media' else 'owner-media' end,
      'ownerNotes', p.owner_notes, 'notes', r.notes, 'preferredStart', r.preferred_start, 'windows', r.windows, 'minutes', r.estimate_minutes, 'estimateCents', r.estimate_cents, 'estimateFrom', r.estimate_from,
      'commissionCents', case when pol.groomer_commission_percent is null or r.estimate_cents is null then null else (r.estimate_cents * pol.groomer_commission_percent / 100) end,
      'deadline', r.accept_deadline, 'assignedToMe', coalesce(r.assigned_groomer_id = me.id, false),
      'services', (select coalesce(jsonb_agg(s.name order by s.position), '[]') from public.booking_request_services s where s.request_id = r.id),
      'starts', (select coalesce(jsonb_agg(s order by s), '[]') from public.request_candidate_starts(r.id) s where s > now() and public.slot_fits_hours(r.location_id, me.id, s, s + make_interval(mins => r.block_minutes)))
    ) order by coalesce(r.preferred_start, r.created_at)), '[]')
    from public.booking_requests r join public.pets p on p.id = r.pet_id left join public.owner_pets op on op.id = p.owner_pet_id
    where r.business_id = p_business and r.status = 'open' and (r.accept_deadline is null or r.accept_deadline > now())
      and (r.assigned_groomer_id is null or r.assigned_groomer_id = me.id) and me.role in ('owner', 'manager', 'groomer') and public.groomer_can_do(me.id, r.id));
end;
$$;

-- ---------------------------------------------------------------------
-- Housekeeping (idempotent; runs when the relevant pages load)
-- ---------------------------------------------------------------------
create or replace function public.tidy_booking_requests(p_business uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare r record; n integer := 0;
begin
  -- Only members of the business or (for their own requests) customers trigger it; it only moves due requests on.
  for r in
    select br.*, coalesce(l.timezone, b.timezone) as tz from public.booking_requests br join public.businesses b on b.id = br.business_id join public.locations l on l.id = br.location_id
    where br.business_id = p_business and br.status in ('awaiting_review', 'open') and (public.is_business_member(br.business_id) or br.requester_id = auth.uid())
    for update of br skip locked
  loop
    if not exists (select 1 from public.request_candidate_starts(r.id) s where s > now()) then
      update public.booking_requests set status = 'expired', accept_deadline = null where id = r.id;
      perform public.log_request_event(r.id, r.business_id, r.status, 'expired', 'The requested time has passed');
      perform public.notify(r.requester_id, r.business_id, 'customer', 'request_expired', public.request_payload(r.id), r.id::text);
      n := n + 1;
    elsif r.status = 'open' and r.accept_deadline is not null and r.accept_deadline < now() then
      update public.booking_requests set status = 'awaiting_review', accept_deadline = null where id = r.id;
      perform public.log_request_event(r.id, r.business_id, 'open', 'awaiting_review', 'No groomer accepted in time');
      perform public.notify_front_desk(r.business_id, 'request_unclaimed', public.request_payload(r.id), r.id::text || ':' || extract(epoch from r.accept_deadline)::bigint);
      n := n + 1;
    end if;
  end loop;
  return n;
end;
$$;

-- Reminders for the signed-in pet owner: confirmed appointments in the next 24 hours.
create or replace function public.queue_my_reminders()
returns void language sql security definer set search_path = '' as $$
  select public.notify(auth.uid(), a.business_id, 'customer', 'appointment_reminder',
    jsonb_build_object('businessName', b.name, 'businessSlug', b.slug, 'timezone', b.timezone, 'petName', p.name, 'startsAt', a.starts_at, 'requestId', (select id from public.booking_requests where appointment_id = a.id)), a.id::text)
  from public.appointments a join public.customers c on c.id = a.customer_id join public.businesses b on b.id = a.business_id join public.pets p on p.id = a.pet_id
  where c.account_user_id = auth.uid() and a.status in ('booked', 'confirmed') and a.starts_at between now() and now() + interval '24 hours';
$$;

-- Groomers set their own weekly hours when the business allows it.
create or replace function public.save_my_hours(p_business uuid, p_location uuid, p_hours jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare me record; h jsonb;
begin
  select * into me from public.business_members where business_id = p_business and user_id = auth.uid() and status = 'active';
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if not coalesce((select groomers_set_own_hours from public.booking_policies where business_id = p_business), false) and me.role not in ('owner', 'manager') then raise exception 'not_allowed' using errcode = '42501'; end if;
  if not exists (select 1 from public.locations where id = p_location and business_id = p_business and archived_at is null) then raise exception 'invalid_location' using errcode = '22023'; end if;
  if jsonb_typeof(p_hours) <> 'array' or jsonb_array_length(p_hours) > 14 then raise exception 'invalid_hours' using errcode = '22023'; end if;
  delete from public.staff_hours where member_id = me.id and location_id = p_location;
  for h in select * from jsonb_array_elements(p_hours) loop
    if (h->>'weekday')::int not between 1 and 7 or (h->>'starts')::time >= (h->>'ends')::time then raise exception 'invalid_hours' using errcode = '22023'; end if;
    insert into public.staff_hours (business_id, member_id, location_id, weekday, starts, ends) values (p_business, me.id, p_location, (h->>'weekday')::int, (h->>'starts')::time, (h->>'ends')::time);
  end loop;
end;
$$;

revoke all on function public.open_booking_request(uuid, uuid, integer), public.close_booking_request(uuid), public.accept_booking_request(uuid, timestamptz), public.shift_board(uuid),
  public.tidy_booking_requests(uuid), public.queue_my_reminders(), public.save_my_hours(uuid, uuid, jsonb) from public, anon;
grant execute on function public.open_booking_request(uuid, uuid, integer), public.close_booking_request(uuid), public.accept_booking_request(uuid, timestamptz), public.shift_board(uuid),
  public.tidy_booking_requests(uuid), public.queue_my_reminders(), public.save_my_hours(uuid, uuid, jsonb) to authenticated;
