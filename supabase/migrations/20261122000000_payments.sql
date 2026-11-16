-- Payments (Stripe Connect), ADR 0004.
--
-- * Option A: Lyra Pet keeps a 5% service fee (GST included) on payments made
--   through the app. Salons connect their own Stripe account; payments are
--   direct charges on that account, so Stripe's card fees are paid by the
--   salon and the 5% is taken as Stripe's application fee. Payments outside
--   the app carry no fee.
-- * Payment in full at booking: when a salon takes payments, a new request is
--   a draft until the customer pays; only then does it reach the salon.
--   Unpaid drafts lapse after two hours.
-- * Refunds: a paid request that is declined, expires, or is cancelled (by
--   the customer within the rules, or by the salon) becomes refund_due; the
--   app refunds in full through Stripe, including the service fee.
-- * Lyra Pet never sees card details. Writes to payment rows come only from
--   the server with the service role (Stripe webhooks and confirmations) or
--   from the definer function that records a checkout for the requester.

create table public.payment_accounts (
  business_id       uuid primary key references public.businesses on delete cascade,
  stripe_account_id text not null unique check (stripe_account_id ~ '^acct_[A-Za-z0-9]+$'),
  charges_enabled   boolean not null default false,
  payouts_enabled   boolean not null default false,
  details_submitted boolean not null default false,
  updated_at        timestamptz not null default now()
);
alter table public.payment_accounts enable row level security;
create policy payment_accounts_select on public.payment_accounts for select to authenticated using (public.has_business_role(business_id, array['owner','manager']::public.business_role[]));
revoke all on public.payment_accounts from anon;
revoke insert, update, delete on public.payment_accounts from authenticated;
grant select on public.payment_accounts to authenticated;

create type public.payment_status as enum ('pending', 'paid', 'refund_due', 'refunded', 'failed', 'expired');
create table public.payments (
  id                         uuid primary key default gen_random_uuid(),
  business_id                uuid not null references public.businesses on delete cascade,
  request_id                 uuid not null,
  customer_id                uuid not null,
  amount_cents               integer not null check (amount_cents > 0),
  fee_cents                  integer not null check (fee_cents >= 0),
  currency                   text not null default 'aud' check (currency = 'aud'),
  status                     public.payment_status not null default 'pending',
  stripe_account_id          text not null,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id   text,
  stripe_refund_id           text,
  refund_reason              text check (refund_reason is null or char_length(refund_reason) <= 200),
  paid_at                    timestamptz,
  refunded_at                timestamptz,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),
  foreign key (request_id, business_id) references public.booking_requests (id, business_id) on delete cascade,
  foreign key (customer_id, business_id) references public.customers (id, business_id) on delete cascade,
  check (fee_cents <= amount_cents)
);
create unique index payments_active_request_uidx on public.payments (request_id) where status in ('pending', 'paid', 'refund_due');
create index payments_business_idx on public.payments (business_id, created_at desc);
create index payments_request_idx on public.payments (request_id);
create index payments_customer_idx on public.payments (customer_id);
create index payments_refund_due_idx on public.payments (status) where status = 'refund_due';
create trigger payments_touch before update on public.payments for each row execute function public.touch_updated_at();
alter table public.payments enable row level security;
create policy payments_staff_select on public.payments for select to authenticated using (public.has_business_role(business_id, array['owner','manager','receptionist']::public.business_role[]));
create policy payments_requester_select on public.payments for select to authenticated using (exists (select 1 from public.booking_requests r where r.id = request_id and r.requester_id = (select auth.uid())));
revoke all on public.payments from anon;
revoke insert, update, delete on public.payments from authenticated;
grant select on public.payments to authenticated;

create or replace function public.payments_enabled(p_business uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select charges_enabled from public.payment_accounts where business_id = p_business), false);
$$;
grant execute on function public.payments_enabled(uuid) to anon, authenticated;

-- The requester records the Stripe Checkout session they're about to pay (amounts come from the request, not the caller).
create or replace function public.record_checkout(p_request uuid, p_session text, p_fee_bps integer)
returns uuid language plpgsql security definer set search_path = '' as $$
declare r record; acct text; pid uuid;
begin
  select * into r from public.booking_requests where id = p_request and requester_id = auth.uid() for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if r.status <> 'draft' or coalesce(r.estimate_cents, 0) <= 0 then raise exception 'not_payable' using errcode = '22023'; end if;
  if p_fee_bps <> 500 then raise exception 'invalid_fee' using errcode = '22023'; end if;
  select stripe_account_id into acct from public.payment_accounts where business_id = r.business_id and charges_enabled;
  if acct is null then raise exception 'payments_off' using errcode = '22023'; end if;
  update public.payments set status = 'expired' where request_id = p_request and status = 'pending';
  insert into public.payments (business_id, request_id, customer_id, amount_cents, fee_cents, stripe_account_id, stripe_checkout_session_id)
  values (r.business_id, r.id, r.customer_id, r.estimate_cents, round(r.estimate_cents * p_fee_bps / 10000.0)::int, acct, p_session)
  returning id into pid;
  return pid;
end;
$$;
revoke all on function public.record_checkout(uuid, text, integer) from public, anon;
grant execute on function public.record_checkout(uuid, text, integer) to authenticated;

-- Server only (service role): Stripe confirmed the payment. The request goes to the salon.
create or replace function public.mark_payment_paid(p_session text, p_intent text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare p record; r record;
begin
  select * into p from public.payments where stripe_checkout_session_id = p_session for update;
  if not found then return null; end if;
  if p.status = 'paid' then return p.request_id; end if;
  if p.status not in ('pending', 'expired') then return p.request_id; end if;
  select * into r from public.booking_requests where id = p.request_id for update;
  update public.payments set status = 'paid', stripe_payment_intent_id = p_intent, paid_at = now() where id = p.id;
  if r.status = 'draft' then
    update public.booking_requests set status = 'submitted' where id = r.id;
    perform public.log_request_event(r.id, r.business_id, 'draft', 'submitted', 'Paid in full');
    perform public.route_new_request(r.id);
  else
    -- Paid after the draft lapsed: refund straight away.
    update public.payments set status = 'refund_due', refund_reason = 'Request had expired before payment' where id = p.id;
  end if;
  return r.id;
end;
$$;

create or replace function public.mark_payment_refunded(p_payment uuid, p_refund text)
returns void language sql security definer set search_path = '' as $$
  update public.payments set status = 'refunded', stripe_refund_id = p_refund, refunded_at = now() where id = p_payment and status = 'refund_due';
$$;

create or replace function public.mark_payment_failed(p_session text)
returns void language sql security definer set search_path = '' as $$
  update public.payments set status = 'failed' where stripe_checkout_session_id = p_session and status = 'pending';
$$;

create or replace function public.sync_payment_account(p_business uuid, p_account text, p_charges boolean, p_payouts boolean, p_details boolean)
returns void language sql security definer set search_path = '' as $$
  insert into public.payment_accounts (business_id, stripe_account_id, charges_enabled, payouts_enabled, details_submitted)
  values (p_business, p_account, p_charges, p_payouts, p_details)
  on conflict (business_id) do update set stripe_account_id = excluded.stripe_account_id, charges_enabled = excluded.charges_enabled, payouts_enabled = excluded.payouts_enabled, details_submitted = excluded.details_submitted, updated_at = now();
$$;
revoke all on function public.mark_payment_paid(text, text), public.mark_payment_refunded(uuid, text), public.mark_payment_failed(text), public.sync_payment_account(uuid, text, boolean, boolean, boolean) from public, anon, authenticated;

-- A paid request that's declined, expires or is cancelled is refunded in full (service fee included).
create or replace function public.refund_on_request_end()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = old.status or new.status not in ('rejected', 'expired', 'cancelled') then return new; end if;
  update public.payments set status = 'refund_due', refund_reason = case new.status when 'rejected' then 'Declined by the salon' when 'expired' then 'Request expired' else 'Cancelled' end
  where request_id = new.id and status = 'paid';
  update public.payments set status = 'expired' where request_id = new.id and status = 'pending';
  return new;
end;
$$;
create trigger booking_requests_refund after update of status on public.booking_requests for each row execute function public.refund_on_request_end();

-- Drafts waiting for payment, and their payments.
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
  if public.payments_enabled(b.id) then
    -- Paid in full at booking: the request waits as a draft until the customer pays, then goes to the salon.
    update public.booking_requests set status = 'draft' where id = req;
    perform public.log_request_event(req, b.id, null, 'draft', 'Waiting for payment');
  else
    perform public.log_request_event(req, b.id, null, 'submitted', null);
    perform public.route_new_request(req);
  end if;
  return req;
end;
$$;

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
  -- Unpaid drafts are let go after two hours.
  update public.booking_requests set status = 'expired'
  where business_id = p_business and status = 'draft' and created_at < now() - interval '2 hours' and (public.is_business_member(business_id) or requester_id = auth.uid());
  return n;
end;
$$;
