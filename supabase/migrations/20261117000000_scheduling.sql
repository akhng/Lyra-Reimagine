-- =====================================================================
-- Lyra Pet — Phase 3: scheduling and the public booking portal.
-- Every table is business-owned (business_id + RLS); cross-table links use
-- composite (id, business_id) foreign keys. No double-booking: an exclusion
-- constraint on (groomer, time range) for live appointments.
-- Anonymous visitors never read tables; booking goes through the
-- security-definer functions at the end, which re-check everything.
-- =====================================================================

create extension if not exists btree_gist with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- A pet must belong to the appointment's customer (composite FK below).
alter table public.pets add constraint pets_id_customer_key unique (id, customer_id);

-- ---------------------------------------------------------------------
-- Hours, time off, closures, booking policy. Times are local wall-clock
-- times in the location's time zone (falling back to the business's).
-- Weekdays are ISO: 1 = Monday … 7 = Sunday.
-- ---------------------------------------------------------------------
create table public.location_hours (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses on delete cascade,
  location_id uuid not null,
  weekday     smallint not null check (weekday between 1 and 7),
  opens       time not null,
  closes      time not null check (closes > opens),
  unique (location_id, weekday, opens),
  foreign key (location_id, business_id) references public.locations (id, business_id) on delete cascade
);
create index location_hours_business_idx on public.location_hours (business_id);

create table public.staff_hours (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses on delete cascade,
  member_id   uuid not null,
  location_id uuid not null,
  weekday     smallint not null check (weekday between 1 and 7),
  starts      time not null,
  ends        time not null check (ends > starts),
  unique (member_id, weekday, starts),
  foreign key (member_id, business_id) references public.business_members (id, business_id) on delete cascade,
  foreign key (location_id, business_id) references public.locations (id, business_id) on delete cascade
);
create index staff_hours_business_idx on public.staff_hours (business_id);
create index staff_hours_location_idx on public.staff_hours (location_id, weekday);

create table public.staff_time_off (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses on delete cascade,
  member_id   uuid not null,
  starts_at   timestamptz not null,
  ends_at     timestamptz not null check (ends_at > starts_at),
  reason      text check (reason is null or char_length(reason) <= 200),
  created_at  timestamptz not null default now(),
  foreign key (member_id, business_id) references public.business_members (id, business_id) on delete cascade
);
create index staff_time_off_member_idx on public.staff_time_off (member_id, starts_at);
create index staff_time_off_business_idx on public.staff_time_off (business_id, starts_at);

create table public.business_closures (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses on delete cascade,
  location_id uuid,
  starts_on   date not null,
  ends_on     date not null check (ends_on >= starts_on),
  reason      text check (reason is null or char_length(reason) <= 120),
  created_at  timestamptz not null default now(),
  foreign key (location_id, business_id) references public.locations (id, business_id) on delete cascade
);
create index business_closures_business_idx on public.business_closures (business_id, starts_on);
create index business_closures_location_idx on public.business_closures (location_id) where location_id is not null;

create table public.booking_policies (
  business_id        uuid primary key references public.businesses on delete cascade,
  online_enabled     boolean not null default false,
  min_notice_minutes integer not null default 120 check (min_notice_minutes between 0 and 20160),
  max_days_ahead     integer not null default 60 check (max_days_ahead between 1 and 365),
  slot_step_minutes  smallint not null default 15 check (slot_step_minutes in (5, 10, 15, 20, 30, 60)),
  cancellation_hours integer not null default 24 check (cancellation_hours between 0 and 336),
  policy_text        text check (policy_text is null or char_length(policy_text) <= 2000),
  updated_at         timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Appointments
-- ---------------------------------------------------------------------
create type public.appointment_status as enum ('booked', 'confirmed', 'checked_in', 'in_progress', 'completed', 'cancelled', 'no_show');

create table public.appointment_series (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references public.businesses on delete cascade,
  interval_weeks smallint not null check (interval_weeks between 1 and 26),
  occurrences    smallint not null check (occurrences between 2 and 26),
  created_by     uuid references auth.users on delete set null default auth.uid(),
  created_at     timestamptz not null default now(),
  unique (id, business_id)
);

create table public.appointments (
  id                  uuid primary key default gen_random_uuid(),
  business_id         uuid not null references public.businesses on delete cascade,
  location_id         uuid not null,
  customer_id         uuid not null,
  pet_id              uuid not null,
  groomer_id          uuid not null,
  starts_at           timestamptz not null,
  service_ends_at     timestamptz not null,
  -- ends_at includes the clean-up buffer; overlap is checked on [starts_at, ends_at).
  ends_at             timestamptz not null,
  status              public.appointment_status not null default 'booked',
  source              text not null default 'staff' check (source in ('staff', 'online')),
  notes               text check (notes is null or char_length(notes) <= 2000),
  customer_notes      text check (customer_notes is null or char_length(customer_notes) <= 1000),
  price_estimate_cents integer check (price_estimate_cents is null or price_estimate_cents between 0 and 100000000),
  price_from          boolean not null default false,
  series_id           uuid,
  grooming_record_id  uuid,
  manage_token_hash   text unique check (manage_token_hash is null or manage_token_hash ~ '^[0-9a-f]{64}$'),
  cancelled_at        timestamptz,
  cancelled_by        text check (cancelled_by is null or cancelled_by in ('staff', 'customer')),
  cancellation_reason text check (cancellation_reason is null or char_length(cancellation_reason) <= 300),
  created_by          uuid references auth.users on delete set null default auth.uid(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (id, business_id),
  check (service_ends_at > starts_at and ends_at >= service_ends_at and ends_at - starts_at <= interval '12 hours'),
  check ((status = 'cancelled') = (cancelled_at is not null)),
  foreign key (location_id, business_id) references public.locations (id, business_id),
  foreign key (customer_id, business_id) references public.customers (id, business_id),
  foreign key (pet_id, business_id) references public.pets (id, business_id),
  foreign key (pet_id, customer_id) references public.pets (id, customer_id),
  foreign key (groomer_id, business_id) references public.business_members (id, business_id),
  foreign key (series_id, business_id) references public.appointment_series (id, business_id),
  foreign key (grooming_record_id, business_id) references public.grooming_records (id, business_id) on delete set null (grooming_record_id),
  constraint appointments_no_overlap exclude using gist (groomer_id with =, tstzrange(starts_at, ends_at, '[)') with &&) where (status not in ('cancelled', 'no_show'))
);
create index appointments_business_time_idx on public.appointments (business_id, starts_at);
create index appointments_groomer_time_idx on public.appointments (groomer_id, starts_at);
create index appointments_location_idx on public.appointments (location_id, starts_at);
create index appointments_customer_idx on public.appointments (customer_id, starts_at desc);
create index appointments_pet_idx on public.appointments (pet_id, starts_at desc);
create index appointments_series_idx on public.appointments (series_id) where series_id is not null;
create index appointments_record_idx on public.appointments (grooming_record_id) where grooming_record_id is not null;

create table public.appointment_services (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references public.businesses on delete cascade,
  appointment_id   uuid not null,
  service_id       uuid,
  name             text not null check (char_length(name) between 1 and 80),
  duration_minutes smallint not null check (duration_minutes between 5 and 600),
  price_cents      integer not null check (price_cents between 0 and 10000000),
  position         smallint not null default 0,
  foreign key (appointment_id, business_id) references public.appointments (id, business_id) on delete cascade,
  foreign key (service_id, business_id) references public.services (id, business_id) on delete set null (service_id)
);
create index appointment_services_appointment_idx on public.appointment_services (appointment_id);
create index appointment_services_service_idx on public.appointment_services (service_id) where service_id is not null;
create index appointment_services_business_idx on public.appointment_services (business_id);

-- ---------------------------------------------------------------------
-- Waitlist
-- ---------------------------------------------------------------------
create table public.waitlist_entries (
  id                   uuid primary key default gen_random_uuid(),
  business_id          uuid not null references public.businesses on delete cascade,
  customer_id          uuid not null,
  pet_id               uuid not null,
  service_ids          uuid[] not null default '{}' check (cardinality(service_ids) <= 10),
  preferred_groomer_id uuid,
  location_id          uuid,
  earliest_on          date not null,
  latest_on            date not null check (latest_on >= earliest_on),
  notes                text check (notes is null or char_length(notes) <= 1000),
  status               text not null default 'waiting' check (status in ('waiting', 'offered', 'booked', 'cancelled')),
  created_by           uuid references auth.users on delete set null default auth.uid(),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  foreign key (customer_id, business_id) references public.customers (id, business_id),
  foreign key (pet_id, customer_id) references public.pets (id, customer_id),
  foreign key (preferred_groomer_id, business_id) references public.business_members (id, business_id) on delete set null (preferred_groomer_id),
  foreign key (location_id, business_id) references public.locations (id, business_id) on delete set null (location_id)
);
create index waitlist_business_idx on public.waitlist_entries (business_id, status, earliest_on);
create index waitlist_customer_idx on public.waitlist_entries (customer_id);
create index waitlist_pet_idx on public.waitlist_entries (pet_id);
create index waitlist_groomer_idx on public.waitlist_entries (preferred_groomer_id) where preferred_groomer_id is not null;
create index waitlist_location_idx on public.waitlist_entries (location_id) where location_id is not null;

-- Rate limiting for the public booking functions (no personal data: hashes only).
create table public.booking_attempts (
  id          bigint generated always as identity primary key,
  business_id uuid not null references public.businesses on delete cascade,
  client_hash text check (client_hash is null or client_hash ~ '^[0-9a-f]{16,64}$'),
  email_hash  text not null,
  created_at  timestamptz not null default now()
);
create index booking_attempts_business_idx on public.booking_attempts (business_id, created_at);
create index booking_attempts_client_idx on public.booking_attempts (client_hash, created_at) where client_hash is not null;
create index booking_attempts_email_idx on public.booking_attempts (email_hash, created_at);

create trigger appointments_touch before update on public.appointments for each row execute function public.touch_updated_at();
create trigger waitlist_touch before update on public.waitlist_entries for each row execute function public.touch_updated_at();
create trigger booking_policies_touch before update on public.booking_policies for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.location_hours enable row level security;
alter table public.staff_hours enable row level security;
alter table public.staff_time_off enable row level security;
alter table public.business_closures enable row level security;
alter table public.booking_policies enable row level security;
alter table public.appointment_series enable row level security;
alter table public.appointments enable row level security;
alter table public.appointment_services enable row level security;
alter table public.waitlist_entries enable row level security;
alter table public.booking_attempts enable row level security;

-- Hours, time off, closures and policy: all staff read; owners and managers manage.
do $$
declare t text;
begin
  foreach t in array array['location_hours', 'staff_hours', 'staff_time_off', 'business_closures', 'booking_policies'] loop
    execute format('create policy %1$s_select on public.%1$s for select to authenticated using (public.is_business_member(business_id))', t);
    execute format('create policy %1$s_write on public.%1$s for all to authenticated using (public.has_business_role(business_id, array[''owner'',''manager'']::public.business_role[])) with check (public.has_business_role(business_id, array[''owner'',''manager'']::public.business_role[]))', t);
  end loop;
  -- Appointments, their services, series and the waitlist: all staff read; front desk (owner, manager, reception) writes.
  foreach t in array array['appointments', 'appointment_services', 'appointment_series', 'waitlist_entries'] loop
    execute format('create policy %1$s_select on public.%1$s for select to authenticated using (public.is_business_member(business_id))', t);
    execute format('create policy %1$s_insert on public.%1$s for insert to authenticated with check (public.has_business_role(business_id, array[''owner'',''manager'',''receptionist'']::public.business_role[]))', t);
    execute format('create policy %1$s_update on public.%1$s for update to authenticated using (public.has_business_role(business_id, array[''owner'',''manager'',''receptionist'']::public.business_role[])) with check (public.has_business_role(business_id, array[''owner'',''manager'',''receptionist'']::public.business_role[]))', t);
  end loop;
end $$;
-- Appointment services are replaced when an appointment's services change.
create policy appointment_services_delete on public.appointment_services for delete to authenticated using (public.has_business_role(business_id, array['owner','manager','receptionist']::public.business_role[]));
-- booking_attempts: no policies (written only by the booking functions).

-- History is kept: appointments are cancelled, never deleted.
revoke delete on public.appointments, public.appointment_series, public.waitlist_entries from authenticated, anon;
revoke all on public.booking_attempts from authenticated, anon;
-- The manage token hash is never readable by clients: a table-level grant would
-- override a column revoke, so grant every other column explicitly.
revoke select on public.appointments from authenticated, anon;
grant select (id, business_id, location_id, customer_id, pet_id, groomer_id, starts_at, service_ends_at, ends_at, status, source, notes, customer_notes,
  price_estimate_cents, price_from, series_id, grooming_record_id, cancelled_at, cancelled_by, cancellation_reason, created_by, created_at, updated_at)
  on public.appointments to authenticated;

-- ---------------------------------------------------------------------
-- Status changes. Front desk may set any status; a groomer may move their
-- own appointments through check-in, in progress, completed and no-show.
-- ---------------------------------------------------------------------
create or replace function public.set_appointment_status(p_id uuid, p_status public.appointment_status, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare a record;
begin
  select ap.id, ap.business_id, ap.groomer_id, ap.status into a from public.appointments ap where ap.id = p_id;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if not public.has_business_role(a.business_id, array['owner','manager','receptionist']::public.business_role[]) then
    if not (p_status in ('checked_in', 'in_progress', 'completed', 'no_show')
            and exists (select 1 from public.business_members m where m.id = a.groomer_id and m.user_id = (select auth.uid()) and m.status = 'active')) then
      raise exception 'forbidden' using errcode = '42501';
    end if;
  end if;
  update public.appointments
     set status = p_status,
         cancelled_at = case when p_status = 'cancelled' then coalesce(cancelled_at, now()) else null end,
         cancelled_by = case when p_status = 'cancelled' then 'staff' else null end,
         cancellation_reason = case when p_status = 'cancelled' then left(p_reason, 300) else null end
   where id = p_id;
end $$;
revoke all on function public.set_appointment_status(uuid, public.appointment_status, text) from public, anon;
grant execute on function public.set_appointment_status(uuid, public.appointment_status, text) to authenticated;

-- ---------------------------------------------------------------------
-- Helpers for the booking functions.
-- ---------------------------------------------------------------------
-- Whether [starts, ends) fits the location's opening hours and the groomer's hours
-- that local day, avoiding time off and closures. Overlap is left to the constraint.
create or replace function public.slot_fits_hours(p_location uuid, p_groomer uuid, p_starts timestamptz, p_ends timestamptz)
returns boolean language sql stable security definer set search_path = '' as $$
  with z as (
    select coalesce(l.timezone, b.timezone) as tz, l.business_id
    from public.locations l join public.businesses b on b.id = l.business_id
    where l.id = p_location
  ), loc as (
    select (p_starts at time zone z.tz) as ls, (p_ends at time zone z.tz) as le, z.business_id from z
  )
  select coalesce((
    select loc.ls::date = loc.le::date
       and exists (select 1 from public.location_hours h where h.location_id = p_location and h.weekday = extract(isodow from loc.ls)::int and h.opens <= loc.ls::time and h.closes >= loc.le::time)
       and exists (select 1 from public.staff_hours s where s.member_id = p_groomer and s.location_id = p_location and s.weekday = extract(isodow from loc.ls)::int and s.starts <= loc.ls::time and s.ends >= loc.le::time)
       and not exists (select 1 from public.staff_time_off t where t.member_id = p_groomer and tstzrange(t.starts_at, t.ends_at) && tstzrange(p_starts, p_ends))
       and not exists (select 1 from public.business_closures c where c.business_id = loc.business_id and (c.location_id is null or c.location_id = p_location) and loc.ls::date between c.starts_on and c.ends_on)
    from loc
  ), false);
$$;
revoke all on function public.slot_fits_hours(uuid, uuid, timestamptz, timestamptz) from public, anon, authenticated;

-- Price for one service and pet: a breed rule beats a size rule, which beats the base price.
create or replace function public.service_price_for(p_service uuid, p_breed text, p_size text)
returns integer language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select r.price_cents from public.service_price_rules r where r.service_id = p_service and r.kind = 'breed' and lower(btrim(r.match_value)) = lower(btrim(p_breed)) limit 1),
    (select r.price_cents from public.service_price_rules r where r.service_id = p_service and r.kind = 'size' and r.match_value = p_size limit 1),
    (select s.base_price_cents from public.services s where s.id = p_service)
  );
$$;
revoke all on function public.service_price_for(uuid, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Public booking functions (anonymous). They expose no customer data.
-- ---------------------------------------------------------------------
create or replace function public.booking_context(p_slug text, p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare b record; pol record;
begin
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 62 then raise exception 'invalid_range' using errcode = '22023'; end if;
  select id, name, slug, timezone, phone, email into b from public.businesses where slug = lower(btrim(p_slug)) and status = 'active';
  if not found then return null; end if;
  select * into pol from public.booking_policies where business_id = b.id;
  if not found or not pol.online_enabled then
    return jsonb_build_object('online', false, 'business', jsonb_build_object('name', b.name, 'slug', b.slug, 'phone', b.phone, 'email', b.email));
  end if;
  return jsonb_build_object(
    'online', true,
    'business', jsonb_build_object('id', b.id, 'name', b.name, 'slug', b.slug, 'timezone', b.timezone, 'phone', b.phone, 'email', b.email),
    'policy', jsonb_build_object('minNoticeMinutes', pol.min_notice_minutes, 'maxDaysAhead', pol.max_days_ahead, 'slotStepMinutes', pol.slot_step_minutes, 'cancellationHours', pol.cancellation_hours, 'policyText', pol.policy_text),
    'locations', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', l.id, 'name', l.name, 'suburb', l.suburb, 'addressLine', l.address_line, 'timezone', coalesce(l.timezone, b.timezone),
        'hours', (select coalesce(jsonb_agg(jsonb_build_object('weekday', h.weekday, 'opens', to_char(h.opens, 'HH24:MI'), 'closes', to_char(h.closes, 'HH24:MI')) order by h.weekday, h.opens), '[]'::jsonb) from public.location_hours h where h.location_id = l.id)
      ) order by l.name), '[]'::jsonb)
      from public.locations l where l.business_id = b.id and l.archived_at is null and not l.is_mobile),
    'services', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', s.id, 'name', s.name, 'description', s.description, 'category', s.category, 'durationMinutes', s.duration_minutes, 'bufferMinutes', s.buffer_minutes,
        'basePriceCents', s.base_price_cents, 'priceFrom', s.price_from,
        'rules', (select coalesce(jsonb_agg(jsonb_build_object('kind', r.kind, 'matchValue', r.match_value, 'priceCents', r.price_cents)), '[]'::jsonb) from public.service_price_rules r where r.service_id = s.id and r.kind in ('size', 'breed'))
      ) order by s.position, s.name), '[]'::jsonb)
      from public.services s where s.business_id = b.id and s.active and s.bookable_online),
    'groomers', (select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'name', coalesce(split_part(m.display_name, ' ', 1), 'Groomer')) order by m.created_at), '[]'::jsonb)
      from public.business_members m where m.business_id = b.id and m.status = 'active' and exists (select 1 from public.staff_hours sh where sh.member_id = m.id)),
    'staffHours', (select coalesce(jsonb_agg(jsonb_build_object('memberId', sh.member_id, 'locationId', sh.location_id, 'weekday', sh.weekday, 'starts', to_char(sh.starts, 'HH24:MI'), 'ends', to_char(sh.ends, 'HH24:MI'))), '[]'::jsonb)
      from public.staff_hours sh where sh.business_id = b.id),
    'busy', (select coalesce(jsonb_agg(jsonb_build_object('memberId', x.member_id, 'startsAt', x.starts_at, 'endsAt', x.ends_at)), '[]'::jsonb) from (
        select a.groomer_id as member_id, a.starts_at, a.ends_at from public.appointments a
         where a.business_id = b.id and a.status not in ('cancelled', 'no_show') and a.ends_at > (p_from - 1)::timestamptz and a.starts_at < (p_to + 2)::timestamptz
        union all
        select t.member_id, t.starts_at, t.ends_at from public.staff_time_off t
         where t.business_id = b.id and t.ends_at > (p_from - 1)::timestamptz and t.starts_at < (p_to + 2)::timestamptz
      ) x),
    'closures', (select coalesce(jsonb_agg(jsonb_build_object('locationId', c.location_id, 'startsOn', c.starts_on, 'endsOn', c.ends_on)), '[]'::jsonb)
      from public.business_closures c where c.business_id = b.id and c.ends_on >= p_from and c.starts_on <= p_to)
  );
end $$;

-- Picks a groomer who can take [starts, ends) at the location (preferring the requested one), or null.
create or replace function public.pick_groomer(p_business uuid, p_location uuid, p_groomer uuid, p_starts timestamptz, p_ends timestamptz, p_exclude uuid default null)
returns uuid language sql stable security definer set search_path = '' as $$
  select m.id from public.business_members m
   where m.business_id = p_business and m.status = 'active' and (p_groomer is null or m.id = p_groomer)
     and public.slot_fits_hours(p_location, m.id, p_starts, p_ends)
     and not exists (select 1 from public.appointments a where a.groomer_id = m.id and a.status not in ('cancelled', 'no_show') and (p_exclude is null or a.id <> p_exclude) and tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(p_starts, p_ends, '[)'))
   -- Spread online bookings: the groomer with the fewest appointments that day first.
   order by (select count(*) from public.appointments a2 where a2.groomer_id = m.id and a2.status not in ('cancelled', 'no_show') and a2.starts_at::date = p_starts::date), m.created_at
   limit 1;
$$;
revoke all on function public.pick_groomer(uuid, uuid, uuid, timestamptz, timestamptz, uuid) from public, anon, authenticated;

create or replace function public.create_online_booking(
  p_slug text, p_location uuid, p_groomer uuid, p_service_ids uuid[], p_starts_at timestamptz,
  p_customer jsonb, p_pet jsonb, p_notes text default null, p_client_hash text default null
) returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  b record; pol record;
  v_first text := btrim(coalesce(p_customer->>'firstName', ''));
  v_last text := nullif(btrim(coalesce(p_customer->>'lastName', '')), '');
  v_email text := lower(btrim(coalesce(p_customer->>'email', '')));
  v_mobile text := btrim(coalesce(p_customer->>'mobile', ''));
  v_digits text;
  v_marketing boolean := coalesce((p_customer->>'marketingConsent')::boolean, false);
  v_pet_name text := btrim(coalesce(p_pet->>'name', ''));
  v_species text := coalesce(nullif(p_pet->>'species', ''), 'dog');
  v_breed text := nullif(btrim(coalesce(p_pet->>'breed', '')), '');
  v_size text := nullif(p_pet->>'size', '');
  v_ids uuid[]; v_count int; v_dur int; v_buf int; v_price int; v_from boolean;
  v_service_end timestamptz; v_ends timestamptz; v_groomer uuid; v_customer uuid; v_pet uuid; v_appt uuid; v_token text;
begin
  select id, name, slug, timezone into b from public.businesses where slug = lower(btrim(p_slug)) and status = 'active';
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  select * into pol from public.booking_policies where business_id = b.id;
  if not found or not pol.online_enabled then raise exception 'online_off' using errcode = 'P0001'; end if;

  -- Validate the visitor's details (the app validates too; this is the trust boundary).
  if char_length(v_first) not between 1 and 80 or char_length(coalesce(v_last, '')) > 80 then raise exception 'invalid_name' using errcode = '22023'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 254 then raise exception 'invalid_email' using errcode = '22023'; end if;
  v_digits := regexp_replace(v_mobile, '\D', '', 'g');
  if v_mobile !~ '^\+?[0-9 ]{8,20}$' then raise exception 'invalid_mobile' using errcode = '22023'; end if;
  if char_length(v_pet_name) not between 1 and 60 or v_species not in ('dog', 'cat', 'other') or (v_size is not null and v_size not in ('toy', 'small', 'medium', 'large', 'giant')) or char_length(coalesce(v_breed, '')) > 80 then raise exception 'invalid_pet' using errcode = '22023'; end if;
  if char_length(coalesce(p_notes, '')) > 1000 then raise exception 'invalid_notes' using errcode = '22023'; end if;

  -- Rate limits: per business per hour, per client per hour, per email per day.
  if (select count(*) from public.booking_attempts where business_id = b.id and created_at > now() - interval '1 hour') >= 60
     or (p_client_hash is not null and (select count(*) from public.booking_attempts where client_hash = p_client_hash and created_at > now() - interval '1 hour') >= 8)
     or (select count(*) from public.booking_attempts where email_hash = encode(extensions.digest(v_email, 'sha256'), 'hex') and created_at > now() - interval '1 day') >= 5 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  insert into public.booking_attempts (business_id, client_hash, email_hash) values (b.id, p_client_hash, encode(extensions.digest(v_email, 'sha256'), 'hex'));

  -- Services: online-bookable, active, this business.
  select array_agg(distinct x) into v_ids from unnest(p_service_ids) x;
  if v_ids is null or cardinality(v_ids) not between 1 and 5 then raise exception 'invalid_services' using errcode = '22023'; end if;
  select count(*), sum(duration_minutes), max(buffer_minutes), sum(public.service_price_for(id, v_breed, v_size)), bool_or(price_from)
    into v_count, v_dur, v_buf, v_price, v_from
    from public.services where business_id = b.id and id = any (v_ids) and active and bookable_online;
  if v_count <> cardinality(v_ids) then raise exception 'invalid_services' using errcode = '22023'; end if;

  -- Timing: within notice and horizon, inside hours, a free groomer.
  if p_starts_at < now() + make_interval(mins => pol.min_notice_minutes) or p_starts_at > now() + make_interval(days => pol.max_days_ahead) then
    raise exception 'outside_window' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.locations where id = p_location and business_id = b.id and archived_at is null and not is_mobile) then raise exception 'invalid_location' using errcode = '22023'; end if;
  v_service_end := p_starts_at + make_interval(mins => v_dur);
  v_ends := v_service_end + make_interval(mins => v_buf);
  v_groomer := public.pick_groomer(b.id, p_location, p_groomer, p_starts_at, v_ends);
  if v_groomer is null then raise exception 'slot_unavailable' using errcode = 'P0001'; end if;

  -- Customer: reuse only when both email and mobile match an existing record; otherwise a new customer (staff can merge).
  select c.id into v_customer from public.customers c join public.customer_contacts cc on cc.customer_id = c.id
   where c.business_id = b.id and c.archived_at is null and lower(cc.email::text) = v_email and regexp_replace(coalesce(cc.mobile, ''), '\D', '', 'g') = v_digits
   order by c.created_at limit 1;
  if v_customer is null then
    insert into public.customers (business_id, first_name, last_name, preferred_contact, marketing_consent, marketing_consent_at, created_by)
    values (b.id, v_first, v_last, 'email', v_marketing, case when v_marketing then now() end, null) returning id into v_customer;
    insert into public.customer_contacts (customer_id, business_id, email, mobile) values (v_customer, b.id, v_email, v_mobile);
  elsif v_marketing then
    update public.customers set marketing_consent = true, marketing_consent_at = coalesce(marketing_consent_at, now()) where id = v_customer;
  end if;
  select p.id into v_pet from public.pets p where p.customer_id = v_customer and lower(p.name) = lower(v_pet_name) and p.archived_at is null order by p.created_at limit 1;
  if v_pet is null then
    insert into public.pets (business_id, customer_id, name, species, breed, size) values (b.id, v_customer, v_pet_name, v_species::public.pet_species, v_breed, v_size::public.pet_size) returning id into v_pet;
  end if;

  v_token := encode(extensions.gen_random_bytes(24), 'hex');
  insert into public.appointments (business_id, location_id, customer_id, pet_id, groomer_id, starts_at, service_ends_at, ends_at, status, source, customer_notes, price_estimate_cents, price_from, manage_token_hash, created_by)
  values (b.id, p_location, v_customer, v_pet, v_groomer, p_starts_at, v_service_end, v_ends, 'booked', 'online', nullif(btrim(coalesce(p_notes, '')), ''), v_price, coalesce(v_from, false), encode(extensions.digest(v_token, 'sha256'), 'hex'), null)
  returning id into v_appt;
  insert into public.appointment_services (business_id, appointment_id, service_id, name, duration_minutes, price_cents, position)
  select b.id, v_appt, s.id, s.name, s.duration_minutes, public.service_price_for(s.id, v_breed, v_size), row_number() over (order by s.position, s.name)
    from public.services s where s.id = any (v_ids);

  return jsonb_build_object('appointmentId', v_appt, 'token', v_token, 'startsAt', p_starts_at, 'endsAt', v_service_end, 'priceCents', v_price, 'priceFrom', coalesce(v_from, false),
    'groomer', (select coalesce(split_part(display_name, ' ', 1), 'Groomer') from public.business_members where id = v_groomer));
exception when exclusion_violation then
  raise exception 'slot_unavailable' using errcode = 'P0001';
end $$;

-- What the manage link shows: the booking, no other customer data.
create or replace function public.get_booking_by_token(p_token text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', a.id, 'status', a.status, 'startsAt', a.starts_at, 'endsAt', a.service_ends_at,
    'business', jsonb_build_object('name', b.name, 'slug', b.slug, 'phone', b.phone, 'email', b.email, 'timezone', coalesce(l.timezone, b.timezone)),
    'location', jsonb_build_object('id', l.id, 'name', l.name, 'addressLine', l.address_line, 'suburb', l.suburb),
    'pet', p.name,
    'groomer', coalesce(split_part(m.display_name, ' ', 1), 'Groomer'),
    'groomerId', m.id,
    'locationId', a.location_id,
    'blockMinutes', (extract(epoch from a.ends_at - a.starts_at) / 60)::int,
    'serviceMinutes', (extract(epoch from a.service_ends_at - a.starts_at) / 60)::int,
    'services', (select coalesce(jsonb_agg(jsonb_build_object('name', s.name, 'durationMinutes', s.duration_minutes, 'priceCents', s.price_cents) order by s.position), '[]'::jsonb) from public.appointment_services s where s.appointment_id = a.id),
    'priceCents', a.price_estimate_cents, 'priceFrom', a.price_from,
    'cancellationHours', coalesce(pol.cancellation_hours, 24), 'policyText', pol.policy_text,
    'changeable', a.status in ('booked', 'confirmed') and a.starts_at - now() > make_interval(hours => coalesce(pol.cancellation_hours, 24))
  )
  from public.appointments a
  join public.businesses b on b.id = a.business_id
  join public.locations l on l.id = a.location_id
  join public.pets p on p.id = a.pet_id
  join public.business_members m on m.id = a.groomer_id
  left join public.booking_policies pol on pol.business_id = a.business_id
  where p_token ~ '^[0-9a-f]{48}$' and a.manage_token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');
$$;

create or replace function public.cancel_booking_by_token(p_token text)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare a record;
begin
  select ap.id, ap.status, ap.starts_at, coalesce(pol.cancellation_hours, 24) as hours into a
    from public.appointments ap left join public.booking_policies pol on pol.business_id = ap.business_id
   where p_token ~ '^[0-9a-f]{48}$' and ap.manage_token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if a.status not in ('booked', 'confirmed') or a.starts_at - now() <= make_interval(hours => a.hours) then raise exception 'too_late' using errcode = 'P0001'; end if;
  update public.appointments set status = 'cancelled', cancelled_at = now(), cancelled_by = 'customer', cancellation_reason = 'Cancelled online by the customer' where id = a.id;
end $$;

create or replace function public.reschedule_booking_by_token(p_token text, p_starts_at timestamptz, p_groomer uuid default null)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare a record; pol record; v_groomer uuid; v_len interval; v_service interval;
begin
  select ap.* into a from public.appointments ap where p_token ~ '^[0-9a-f]{48}$' and ap.manage_token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  select * into pol from public.booking_policies where business_id = a.business_id;
  if not found or not pol.online_enabled then raise exception 'online_off' using errcode = 'P0001'; end if;
  if a.status not in ('booked', 'confirmed') or a.starts_at - now() <= make_interval(hours => pol.cancellation_hours) then raise exception 'too_late' using errcode = 'P0001'; end if;
  if p_starts_at < now() + make_interval(mins => pol.min_notice_minutes) or p_starts_at > now() + make_interval(days => pol.max_days_ahead) then raise exception 'outside_window' using errcode = 'P0001'; end if;
  v_len := a.ends_at - a.starts_at;
  v_service := a.service_ends_at - a.starts_at;
  v_groomer := public.pick_groomer(a.business_id, a.location_id, p_groomer, p_starts_at, p_starts_at + v_len, a.id);
  if v_groomer is null then raise exception 'slot_unavailable' using errcode = 'P0001'; end if;
  update public.appointments set starts_at = p_starts_at, service_ends_at = p_starts_at + v_service, ends_at = p_starts_at + v_len, groomer_id = v_groomer where id = a.id;
  return jsonb_build_object('startsAt', p_starts_at, 'endsAt', p_starts_at + v_service);
exception when exclusion_violation then
  raise exception 'slot_unavailable' using errcode = 'P0001';
end $$;

revoke all on function public.booking_context(text, date, date) from public;
revoke all on function public.create_online_booking(text, uuid, uuid, uuid[], timestamptz, jsonb, jsonb, text, text) from public;
revoke all on function public.get_booking_by_token(text) from public;
revoke all on function public.cancel_booking_by_token(text) from public;
revoke all on function public.reschedule_booking_by_token(text, timestamptz, uuid) from public;
grant execute on function public.booking_context(text, date, date) to anon, authenticated;
grant execute on function public.create_online_booking(text, uuid, uuid, uuid[], timestamptz, jsonb, jsonb, text, text) to anon, authenticated;
grant execute on function public.get_booking_by_token(text) to anon, authenticated;
grant execute on function public.cancel_booking_by_token(text) to anon, authenticated;
grant execute on function public.reschedule_booking_by_token(text, timestamptz, uuid) to anon, authenticated;
