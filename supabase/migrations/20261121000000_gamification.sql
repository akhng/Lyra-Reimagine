-- Transformation R5 (ADR 0003): a reusable gamification engine, loyalty and reviews.
--
-- * Points live in a ledger (earned and redeemed). Every entry has a source
--   key that is unique per business and customer, so the same event can never
--   pay twice. Points are earned only when an appointment is COMPLETED (never
--   for submitting a request), plus optional pet birthday points; a completed
--   appointment that's later changed is reversed.
-- * Each business sets its own rules (loyalty_settings) and rewards
--   (loyalty_rewards). Redeeming is done by the front desk and needs enough
--   points. Gamification never touches prices, availability or payments.
-- * Achievements are awarded once (unique per subject and key) for pets'
--   grooming milestones and business milestones, with notifications.
-- * Reviews: one per completed appointment, by the customer who owns it.

create table public.loyalty_settings (
  business_id            uuid primary key references public.businesses on delete cascade,
  enabled                boolean not null default true,
  points_per_appointment integer not null default 10 check (points_per_appointment between 0 and 10000),
  points_per_dollar      numeric(6,2) not null default 1 check (points_per_dollar between 0 and 100),
  birthday_points        integer not null default 50 check (birthday_points between 0 and 10000),
  achievements_enabled   boolean not null default true,
  updated_at             timestamptz not null default now()
);
alter table public.loyalty_settings enable row level security;
create policy loyalty_settings_select on public.loyalty_settings for select to authenticated using (public.is_business_member(business_id));
create policy loyalty_settings_write on public.loyalty_settings for all to authenticated
  using (public.has_business_role(business_id, array['owner','manager']::public.business_role[]))
  with check (public.has_business_role(business_id, array['owner','manager']::public.business_role[]));
revoke all on public.loyalty_settings from anon;
grant select, insert, update on public.loyalty_settings to authenticated;

create table public.loyalty_rewards (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses on delete cascade,
  name        text not null check (char_length(name) between 1 and 80),
  description text check (description is null or char_length(description) <= 300),
  cost_points integer not null check (cost_points between 1 and 1000000),
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (id, business_id)
);
create index loyalty_rewards_business_idx on public.loyalty_rewards (business_id, active);
alter table public.loyalty_rewards enable row level security;
create policy loyalty_rewards_select on public.loyalty_rewards for select to authenticated using (public.is_business_member(business_id));
create policy loyalty_rewards_write on public.loyalty_rewards for all to authenticated
  using (public.has_business_role(business_id, array['owner','manager']::public.business_role[]))
  with check (public.has_business_role(business_id, array['owner','manager']::public.business_role[]));
revoke all on public.loyalty_rewards from anon;
grant select, insert, update on public.loyalty_rewards to authenticated;

create table public.points_ledger (
  id          bigint generated always as identity primary key,
  business_id uuid not null references public.businesses on delete cascade,
  customer_id uuid not null,
  delta       integer not null check (delta <> 0),
  reason      text not null check (reason in ('appointment', 'birthday', 'redemption', 'reversal', 'adjustment')),
  source_key  text not null check (char_length(source_key) <= 120),
  reward_id   uuid,
  note        text check (note is null or char_length(note) <= 200),
  created_by  uuid references auth.users on delete set null,
  created_at  timestamptz not null default now(),
  unique (business_id, customer_id, source_key),
  foreign key (customer_id, business_id) references public.customers (id, business_id) on delete cascade,
  foreign key (reward_id, business_id) references public.loyalty_rewards (id, business_id) on delete set null (reward_id)
);
create index points_ledger_customer_idx on public.points_ledger (customer_id, created_at desc);
create index points_ledger_business_idx on public.points_ledger (business_id, created_at desc);
create index points_ledger_reward_idx on public.points_ledger (reward_id) where reward_id is not null;
alter table public.points_ledger enable row level security;
create policy points_ledger_select on public.points_ledger for select to authenticated using (public.has_business_role(business_id, array['owner','manager','receptionist']::public.business_role[]));
revoke all on public.points_ledger from anon;
revoke insert, update, delete on public.points_ledger from authenticated;
grant select on public.points_ledger to authenticated;

create table public.achievement_awards (
  id          bigint generated always as identity primary key,
  business_id uuid not null references public.businesses on delete cascade,
  subject     text not null check (subject in ('business', 'pet')),
  pet_id      uuid,
  key         text not null check (char_length(key) <= 60),
  awarded_at  timestamptz not null default now(),
  foreign key (pet_id, business_id) references public.pets (id, business_id) on delete cascade,
  check ((subject = 'pet') = (pet_id is not null))
);
create unique index achievement_awards_business_uidx on public.achievement_awards (business_id, key) where subject = 'business';
create unique index achievement_awards_pet_uidx on public.achievement_awards (pet_id, key) where subject = 'pet';
create index achievement_awards_lookup_idx on public.achievement_awards (business_id, awarded_at desc);
alter table public.achievement_awards enable row level security;
create policy achievement_awards_select on public.achievement_awards for select to authenticated using (public.is_business_member(business_id));
revoke all on public.achievement_awards from anon;
revoke insert, update, delete on public.achievement_awards from authenticated;
grant select on public.achievement_awards to authenticated;

create table public.reviews (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references public.businesses on delete cascade,
  appointment_id uuid not null unique,
  customer_id    uuid not null,
  author_id      uuid not null references auth.users on delete cascade,
  rating         smallint not null check (rating between 1 and 5),
  comment        text check (comment is null or char_length(comment) <= 1000),
  reply          text check (reply is null or char_length(reply) <= 1000),
  replied_at     timestamptz,
  created_at     timestamptz not null default now(),
  foreign key (appointment_id, business_id) references public.appointments (id, business_id) on delete cascade,
  foreign key (customer_id, business_id) references public.customers (id, business_id) on delete cascade
);
create index reviews_business_idx on public.reviews (business_id, created_at desc);
create index reviews_customer_idx on public.reviews (customer_id);
create index reviews_author_idx on public.reviews (author_id);
alter table public.reviews enable row level security;
create policy reviews_staff_select on public.reviews for select to authenticated using (public.is_business_member(business_id));
create policy reviews_author_select on public.reviews for select to authenticated using (author_id = (select auth.uid()));
revoke all on public.reviews from anon;
revoke insert, update, delete on public.reviews from authenticated;
grant select on public.reviews to authenticated;

-- ---------------------------------------------------------------------
-- Engine
-- ---------------------------------------------------------------------
create or replace function public.award_points(p_business uuid, p_customer uuid, p_delta integer, p_reason text, p_source text, p_note text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if p_delta = 0 then return false; end if;
  insert into public.points_ledger (business_id, customer_id, delta, reason, source_key, note, created_by)
  values (p_business, p_customer, p_delta, p_reason, p_source, p_note, auth.uid())
  on conflict (business_id, customer_id, source_key) do nothing;
  get diagnostics n = row_count;
  return n > 0;
end;
$$;

create or replace function public.award_achievement(p_business uuid, p_pet uuid, p_key text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if p_pet is null then
    insert into public.achievement_awards (business_id, subject, key) values (p_business, 'business', p_key) on conflict do nothing;
  else
    insert into public.achievement_awards (business_id, subject, pet_id, key) values (p_business, 'pet', p_pet, p_key) on conflict do nothing;
  end if;
  get diagnostics n = row_count;
  return n > 0;
end;
$$;

-- Business milestones from real records (thresholds mirror features/dashboard/achievements.ts).
create or replace function public.evaluate_business_achievements(p_business uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare completed int; pets int; loyal int; online int; records int; reviews int; avg_rating numeric; k text; got boolean;
begin
  if not coalesce((select achievements_enabled from public.loyalty_settings where business_id = p_business), true) then return; end if;
  select count(*), count(distinct pet_id) into completed, pets from public.appointments where business_id = p_business and status = 'completed';
  select count(*) into loyal from (select customer_id from public.appointments where business_id = p_business and status = 'completed' group by customer_id having count(*) >= 3) x;
  select count(*) into online from public.appointments where business_id = p_business and source = 'online';
  select count(*) into records from public.grooming_records where business_id = p_business;
  select count(*), avg(rating) into reviews, avg_rating from public.reviews where business_id = p_business;
  for k, got in values
    ('first_10', completed >= 10), ('completed_100', completed >= 100), ('happy_pets_50', pets >= 50), ('loyalty_hero', loyal >= 10),
    ('online_star', online >= 25), ('history_keeper', records >= 25), ('five_star', reviews >= 10 and avg_rating >= 4.8)
  loop
    if got and public.award_achievement(p_business, null, k) then
      perform public.notify_front_desk(p_business, 'achievement', jsonb_build_object('key', k), k);
    end if;
  end loop;
end;
$$;

-- Pet milestones: 1st, 5th, 10th and 25th groom at this business.
create or replace function public.evaluate_pet_achievements(p_business uuid, p_pet uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare n int; k text; owner uuid; pet_name text;
begin
  if not coalesce((select achievements_enabled from public.loyalty_settings where business_id = p_business), true) then return; end if;
  select count(*) into n from public.appointments where pet_id = p_pet and status = 'completed';
  select c.account_user_id, p.name into owner, pet_name from public.pets p join public.customers c on c.id = p.customer_id where p.id = p_pet;
  foreach k in array array['grooms_1', 'grooms_5', 'grooms_10', 'grooms_25'] loop
    if n >= split_part(k, '_', 2)::int and public.award_achievement(p_business, p_pet, k) then
      perform public.notify(owner, p_business, 'customer', 'achievement', jsonb_build_object('key', k, 'petName', pet_name, 'count', split_part(k, '_', 2)::int, 'businessName', (select name from public.businesses where id = p_business)), p_pet::text || ':' || k);
    end if;
  end loop;
end;
$$;

-- On completion: points (if loyalty is on) and achievements. A completed appointment that changes status is reversed.
create or replace function public.reward_completed_appointment()
returns trigger language plpgsql security definer set search_path = '' as $$
declare s record; pts integer; owner uuid; earned integer;
begin
  if new.status = old.status then return new; end if;
  select * into s from public.loyalty_settings where business_id = new.business_id;
  if new.status = 'completed' then
    if coalesce(s.enabled, true) then
      pts := coalesce(s.points_per_appointment, 10) + floor(coalesce(new.price_estimate_cents, 0) / 100.0 * coalesce(s.points_per_dollar, 1))::int;
      if pts > 0 and public.award_points(new.business_id, new.customer_id, pts, 'appointment', 'appt:' || new.id, null) then
        select account_user_id into owner from public.customers where id = new.customer_id;
        perform public.notify(owner, new.business_id, 'customer', 'points_earned',
          jsonb_build_object('points', pts, 'petName', (select name from public.pets where id = new.pet_id), 'businessName', (select name from public.businesses where id = new.business_id)), new.id::text);
      end if;
    end if;
    perform public.evaluate_pet_achievements(new.business_id, new.pet_id);
    perform public.evaluate_business_achievements(new.business_id);
  elsif old.status = 'completed' then
    select delta into earned from public.points_ledger where business_id = new.business_id and customer_id = new.customer_id and source_key = 'appt:' || new.id;
    if earned is not null then
      perform public.award_points(new.business_id, new.customer_id, -earned, 'reversal', 'appt-reversal:' || new.id || ':' || extract(epoch from now())::bigint, 'Appointment no longer completed');
    end if;
  end if;
  return new;
end;
$$;
create trigger appointments_reward after update of status on public.appointments for each row execute function public.reward_completed_appointment();

revoke all on function public.award_points(uuid, uuid, integer, text, text, text), public.award_achievement(uuid, uuid, text), public.evaluate_business_achievements(uuid), public.evaluate_pet_achievements(uuid, uuid) from public, anon, authenticated;

-- Front desk redeems a reward for a customer (needs enough points).
create or replace function public.redeem_reward(p_customer uuid, p_reward uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare rw record; bal integer; n int;
begin
  select * into rw from public.loyalty_rewards where id = p_reward and active;
  if not found or not public.has_business_role(rw.business_id, array['owner','manager','receptionist']::public.business_role[]) then raise exception 'not_found' using errcode = 'P0002'; end if;
  if not exists (select 1 from public.customers where id = p_customer and business_id = rw.business_id) then raise exception 'not_found' using errcode = 'P0002'; end if;
  -- Serialise redemptions per customer so two at once can't overspend.
  perform 1 from public.customers where id = p_customer for update;
  select coalesce(sum(delta), 0) into bal from public.points_ledger where business_id = rw.business_id and customer_id = p_customer;
  if bal < rw.cost_points then raise exception 'not_enough_points' using errcode = '22023'; end if;
  insert into public.points_ledger (business_id, customer_id, delta, reason, source_key, reward_id, note, created_by)
  values (rw.business_id, p_customer, -rw.cost_points, 'redemption', 'redeem:' || gen_random_uuid(), rw.id, rw.name, auth.uid());
  return bal - rw.cost_points;
end;
$$;

-- Pet birthday points, once a year, for the signed-in owner's linked pets (claimed when they open the app within 30 days after).
create or replace function public.claim_birthday_rewards()
returns integer language plpgsql security definer set search_path = '' as $$
declare r record; n integer := 0; bday date; yr int;
begin
  for r in
    select p.id as pet_id, p.name, p.business_id, p.customer_id, coalesce(p.date_of_birth, op.date_of_birth) as dob, s.birthday_points, b.timezone, b.name as business_name
    from public.pets p join public.customers c on c.id = p.customer_id left join public.owner_pets op on op.id = p.owner_pet_id
    join public.businesses b on b.id = p.business_id left join public.loyalty_settings s on s.business_id = p.business_id
    where c.account_user_id = auth.uid() and p.archived_at is null and coalesce(p.date_of_birth, op.date_of_birth) is not null and coalesce(s.enabled, true) and coalesce(s.birthday_points, 50) > 0
  loop
    yr := extract(year from (now() at time zone r.timezone))::int;
    bday := make_date(yr, extract(month from r.dob)::int, least(extract(day from r.dob)::int, case when extract(month from r.dob) = 2 then 28 else 30 end));
    if bday > (now() at time zone r.timezone)::date then continue; end if;
    if (now() at time zone r.timezone)::date - bday > 30 then continue; end if;
    if public.award_points(r.business_id, r.customer_id, coalesce(r.birthday_points, 50), 'birthday', 'bday:' || r.pet_id || ':' || yr, r.name || '''s birthday') then
      perform public.notify(auth.uid(), r.business_id, 'customer', 'birthday', jsonb_build_object('petName', r.name, 'points', coalesce(r.birthday_points, 50), 'businessName', r.business_name), r.pet_id || ':' || yr);
      n := n + 1;
    end if;
  end loop;
  return n;
end;
$$;

-- Reviews of completed appointments, by their customer; owners may reply.
create or replace function public.submit_review(p_appointment uuid, p_rating integer, p_comment text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare a record; new_id uuid;
begin
  select ap.*, c.account_user_id into a from public.appointments ap join public.customers c on c.id = ap.customer_id where ap.id = p_appointment;
  if not found or a.account_user_id is distinct from auth.uid() then raise exception 'not_found' using errcode = 'P0002'; end if;
  if a.status <> 'completed' then raise exception 'not_completed' using errcode = '22023'; end if;
  if p_rating not between 1 and 5 or (p_comment is not null and char_length(p_comment) > 1000) then raise exception 'invalid_review' using errcode = '22023'; end if;
  insert into public.reviews (business_id, appointment_id, customer_id, author_id, rating, comment)
  values (a.business_id, a.id, a.customer_id, auth.uid(), p_rating, nullif(btrim(p_comment), ''))
  on conflict (appointment_id) do nothing returning reviews.id into new_id;
  if new_id is null then raise exception 'already_reviewed' using errcode = '23505'; end if;
  perform public.notify_front_desk(a.business_id, 'review_new', jsonb_build_object('rating', p_rating, 'petName', (select name from public.pets where pets.id = a.pet_id)), new_id::text);
  perform public.evaluate_business_achievements(a.business_id);
  return new_id;
end;
$$;

create or replace function public.reply_review(p_review uuid, p_reply text)
returns void language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  select * into r from public.reviews where id = p_review;
  if not found or not public.has_business_role(r.business_id, array['owner','manager']::public.business_role[]) then raise exception 'not_found' using errcode = 'P0002'; end if;
  update public.reviews set reply = nullif(btrim(left(p_reply, 1000)), ''), replied_at = now() where id = p_review;
end;
$$;

-- A pet owner's loyalty across salons: balance, lifetime points, history, rewards on offer, pet awards and their reviews.
create or replace function public.my_loyalty()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'salons', (select coalesce(jsonb_agg(jsonb_build_object(
        'businessName', b.name, 'businessSlug', b.slug, 'enabled', coalesce(s.enabled, true),
        'balance', (select coalesce(sum(delta), 0) from public.points_ledger l where l.customer_id = c.id),
        'lifetime', (select coalesce(sum(delta), 0) from public.points_ledger l where l.customer_id = c.id and l.delta > 0 and l.reason <> 'reversal'),
        'history', (select coalesce(jsonb_agg(jsonb_build_object('delta', l.delta, 'reason', l.reason, 'note', l.note, 'at', l.created_at) order by l.created_at desc), '[]') from (select * from public.points_ledger l2 where l2.customer_id = c.id order by created_at desc limit 20) l),
        'rewards', (select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'name', r.name, 'description', r.description, 'cost', r.cost_points) order by r.cost_points), '[]') from public.loyalty_rewards r where r.business_id = b.id and r.active),
        'rules', jsonb_build_object('perAppointment', coalesce(s.points_per_appointment, 10), 'perDollar', coalesce(s.points_per_dollar, 1), 'birthday', coalesce(s.birthday_points, 50))
      ) order by b.name), '[]')
      from public.customers c join public.businesses b on b.id = c.business_id left join public.loyalty_settings s on s.business_id = b.id
      where c.account_user_id = auth.uid()),
    'petAwards', (select coalesce(jsonb_agg(jsonb_build_object('ownerPetId', p.owner_pet_id, 'petName', p.name, 'key', aw.key, 'at', aw.awarded_at, 'businessName', b.name) order by aw.awarded_at desc), '[]')
      from public.achievement_awards aw join public.pets p on p.id = aw.pet_id join public.customers c on c.id = p.customer_id join public.businesses b on b.id = aw.business_id
      where c.account_user_id = auth.uid()),
    'groomDates', (select coalesce(jsonb_agg(jsonb_build_object('ownerPetId', p.owner_pet_id, 'date', (a.starts_at at time zone b.timezone)::date, 'interval', p.groom_interval_weeks) order by a.starts_at), '[]')
      from public.appointments a join public.pets p on p.id = a.pet_id join public.customers c on c.id = a.customer_id join public.businesses b on b.id = a.business_id
      where c.account_user_id = auth.uid() and a.status = 'completed'),
    'reviews', (select coalesce(jsonb_agg(jsonb_build_object('appointmentId', r.appointment_id, 'rating', r.rating, 'comment', r.comment, 'reply', r.reply)), '[]') from public.reviews r where r.author_id = auth.uid())
  );
$$;

revoke all on function public.redeem_reward(uuid, uuid), public.claim_birthday_rewards(), public.submit_review(uuid, integer, text), public.reply_review(uuid, text), public.my_loyalty() from public, anon;
grant execute on function public.redeem_reward(uuid, uuid), public.claim_birthday_rewards(), public.submit_review(uuid, integer, text), public.reply_review(uuid, text), public.my_loyalty() to authenticated;

-- my_bookings() now includes the appointment id, so a completed request can be reviewed.
create or replace function public.my_bookings()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'requests', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', r.id, 'status', r.status, 'appointmentId', r.appointment_id, 'businessName', b.name, 'businessSlug', b.slug, 'timezone', b.timezone, 'petName', p.name, 'ownerPetId', p.owner_pet_id,
        'preferredStart', r.preferred_start, 'windows', r.windows, 'notes', r.notes, 'estimateCents', r.estimate_cents, 'estimateFrom', r.estimate_from, 'minutes', r.estimate_minutes,
        'services', (select coalesce(jsonb_agg(s.name order by s.position), '[]') from public.booking_request_services s where s.request_id = r.id),
        'appointmentStart', a.starts_at, 'groomerName', m.display_name, 'decisionReason', r.decision_reason, 'createdAt', r.created_at,
        'cancellationHours', (select cancellation_hours from public.booking_policies where business_id = r.business_id),
        'events', (select coalesce(jsonb_agg(jsonb_build_object('status', e.to_status, 'at', e.created_at, 'note', e.note) order by e.created_at), '[]') from public.booking_request_events e where e.request_id = r.id)
      ) order by r.created_at desc), '[]')
      from public.booking_requests r join public.businesses b on b.id = r.business_id join public.pets p on p.id = r.pet_id
      left join public.appointments a on a.id = r.appointment_id left join public.business_members m on m.id = a.groomer_id
      where r.requester_id = auth.uid()),
    'appointments', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', a.id, 'status', a.status, 'startsAt', a.starts_at, 'minutes', extract(epoch from (a.service_ends_at - a.starts_at))::int / 60, 'businessName', b.name, 'businessSlug', b.slug, 'timezone', b.timezone,
        'petName', p.name, 'ownerPetId', p.owner_pet_id, 'groomerName', m.display_name,
        'services', (select coalesce(jsonb_agg(s.name order by s.position), '[]') from public.appointment_services s where s.appointment_id = a.id)
      ) order by a.starts_at desc), '[]')
      from public.appointments a join public.customers c on c.id = a.customer_id join public.businesses b on b.id = a.business_id join public.pets p on p.id = a.pet_id
      left join public.business_members m on m.id = a.groomer_id
      where c.account_user_id = auth.uid() and a.starts_at > now() - interval '2 years')
  );
$$;
