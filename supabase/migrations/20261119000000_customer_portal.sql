-- Transformation R3 (ADR 0003): customer accounts, owner pet profiles,
-- marketplace listings and booking requests.
--
-- * A person (Supabase Auth user) can be staff, a customer, or both.
--   customers.account_user_id links a business's customer record to the
--   person; claim_customer_records() links records whose contact email is the
--   person's VERIFIED email, so existing customers never register twice.
-- * owner_pets are the pet owner's own profiles. Each business pet links to
--   one (pets.owner_pet_id); owner edits flow to linked business pets and
--   the owner's notes are shown to staff read-only (pets.owner_notes).
-- * Booking requests are never appointments until the business has checked
--   availability: review_booking_request() creates the appointment inside the
--   same transaction (the existing no-overlap constraint still applies).
-- * Customers read their own data through definer functions that return
--   only what a pet owner should see (no staff notes, no other customers).

-- ---------------------------------------------------------------------
-- Accounts linked to business customer records
-- ---------------------------------------------------------------------
alter table public.customers add column account_user_id uuid references auth.users on delete set null;
create unique index customers_business_account_uidx on public.customers (business_id, account_user_id) where account_user_id is not null;
create index customers_account_idx on public.customers (account_user_id) where account_user_id is not null;
-- Staff may not re-point a customer record at someone else's account: only the claim/submit functions set it.
-- (A table-level grant would override a column revoke, so the editable columns are granted one by one.)
revoke update on public.customers from authenticated;
grant update (first_name, last_name, preferred_contact, preferred_groomer_id, notes, is_vip, marketing_consent, marketing_consent_at, photo_path, archived_at, updated_at) on public.customers to authenticated;

-- ---------------------------------------------------------------------
-- Owner pet profiles (the pet owner's own data)
-- ---------------------------------------------------------------------
create table public.owner_pets (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users on delete cascade,
  name                  text not null check (char_length(name) between 1 and 60),
  species               public.pet_species not null default 'dog',
  breed                 text check (breed is null or char_length(breed) <= 80),
  size                  public.pet_size,
  date_of_birth         date check (date_of_birth is null or date_of_birth <= current_date),
  estimated_age_years   numeric(4,1) check (estimated_age_years is null or estimated_age_years between 0 and 40),
  weight_kg             numeric(5,2) check (weight_kg is null or weight_kg between 0 and 150),
  coat_type             text check (coat_type is null or char_length(coat_type) <= 80),
  grooming_preferences  text check (grooming_preferences is null or char_length(grooming_preferences) <= 1000),
  care_notes            text check (care_notes is null or char_length(care_notes) <= 1000),
  photo_path            text check (photo_path is null or char_length(photo_path) <= 300),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index owner_pets_user_idx on public.owner_pets (user_id);
alter table public.owner_pets enable row level security;
create policy owner_pets_own on public.owner_pets for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.owner_pets from anon;
grant select, insert, update, delete on public.owner_pets to authenticated;
create trigger owner_pets_touch before update on public.owner_pets for each row execute function public.touch_updated_at();

alter table public.pets add column owner_pet_id uuid references public.owner_pets on delete set null;
alter table public.pets add column owner_notes text check (owner_notes is null or char_length(owner_notes) <= 2100);
create unique index pets_business_owner_pet_uidx on public.pets (business_id, owner_pet_id) where owner_pet_id is not null;
-- Owner notes come only from the owner's profile (trigger below); staff can't edit them or the link.
revoke update on public.pets from authenticated;
grant update (customer_id, name, species, breed, size, date_of_birth, estimated_age_years, sex, desexed, weight_kg, coat_type, coat_colour, microchip, photo_path, groom_interval_weeks, preferred_cut, coat_length, grooming_style, shampoo, finishing_products, nail_preferences, ear_cleaning, behaviour, noise_sensitivity, handling_preferences, allergies, sensitivities, medical_notes, skin_coat_concerns, handling_precautions, emergency_contact, archived_at, updated_at) on public.pets to authenticated;

create or replace function public.owner_notes_text(p_prefs text, p_care text)
returns text language sql immutable set search_path = '' as $$
  select nullif(concat_ws(E'\n', case when p_prefs is not null then 'Grooming preferences: ' || p_prefs end, case when p_care is not null then 'Care and handling: ' || p_care end), '');
$$;

-- Owner edits flow to every linked business pet (identity fields and the owner's notes only).
create or replace function public.sync_owner_pet()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.pets set name = new.name, species = new.species, breed = new.breed, size = coalesce(new.size, size),
    date_of_birth = new.date_of_birth, estimated_age_years = new.estimated_age_years, weight_kg = new.weight_kg,
    coat_type = coalesce(new.coat_type, coat_type), owner_notes = public.owner_notes_text(new.grooming_preferences, new.care_notes), updated_at = now()
  where owner_pet_id = new.id;
  return new;
end;
$$;
create trigger owner_pets_sync after update on public.owner_pets for each row execute function public.sync_owner_pet();

-- Owner photos: private bucket, path <user id>/pets/<owner pet id>/<file>. Staff of a business with a linked pet can view them.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('owner-media', 'owner-media', false, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
create or replace function public.owner_media_visible(p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.owner_pets op join public.pets p on p.owner_pet_id = op.id
    where op.photo_path = p_name and public.is_business_member(p.business_id)
  );
$$;
revoke all on function public.owner_media_visible(text) from public, anon;
grant execute on function public.owner_media_visible(text) to authenticated;
create policy owner_media_own_select on storage.objects for select to authenticated using (bucket_id = 'owner-media' and ((storage.foldername(name))[1] = (select auth.uid())::text or public.owner_media_visible(name)));
create policy owner_media_own_insert on storage.objects for insert to authenticated with check (bucket_id = 'owner-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy owner_media_own_delete on storage.objects for delete to authenticated using (bucket_id = 'owner-media' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------------
-- Marketplace listing (opt-in per business) and favourites
-- ---------------------------------------------------------------------
create table public.marketplace_profiles (
  business_id        uuid primary key references public.businesses on delete cascade,
  listed             boolean not null default false,
  accepting_requests boolean not null default true,
  headline           text check (headline is null or char_length(headline) <= 120),
  about              text check (about is null or char_length(about) <= 1500),
  suburb             text check (suburb is null or char_length(suburb) <= 80),
  mascot             text not null default 'coco' check (mascot in ('coco', 'mochi', 'biscuit', 'luna')),
  updated_at         timestamptz not null default now()
);
alter table public.marketplace_profiles enable row level security;
create policy marketplace_profiles_member_select on public.marketplace_profiles for select to authenticated using (public.is_business_member(business_id));
create policy marketplace_profiles_admin_write on public.marketplace_profiles for all to authenticated
  using (public.has_business_role(business_id, array['owner','manager']::public.business_role[]))
  with check (public.has_business_role(business_id, array['owner','manager']::public.business_role[]));
revoke all on public.marketplace_profiles from anon;
grant select, insert, update on public.marketplace_profiles to authenticated;

create table public.favourite_businesses (
  user_id     uuid not null references auth.users on delete cascade,
  business_id uuid not null references public.businesses on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, business_id)
);
create index favourite_businesses_business_idx on public.favourite_businesses (business_id);
alter table public.favourite_businesses enable row level security;
create policy favourite_businesses_own on public.favourite_businesses for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.favourite_businesses from anon;
grant select, insert, delete on public.favourite_businesses to authenticated;

-- Listed businesses with what a pet owner needs to choose (no customer data).
create or replace function public.marketplace_listings()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'slug', b.slug, 'name', b.name, 'headline', mp.headline, 'suburb', coalesce(mp.suburb, l.suburb), 'mascot', mp.mascot,
    'accepting', mp.accepting_requests,
    'fromCents', (select min(s.base_price_cents) from public.services s where s.business_id = b.id and s.active and s.bookable_online),
    'services', (select count(*) from public.services s where s.business_id = b.id and s.active and s.bookable_online)
  ) order by b.name), '[]'::jsonb)
  from public.marketplace_profiles mp
  join public.businesses b on b.id = mp.business_id and b.status = 'active'
  left join lateral (select suburb from public.locations where business_id = b.id and archived_at is null order by created_at limit 1) l on true
  where mp.listed;
$$;

create or replace function public.marketplace_listing(p_slug text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare b record; mp record; tz text;
begin
  select id, name, slug, timezone, phone into b from public.businesses where slug = lower(btrim(p_slug)) and status = 'active';
  if not found then return null; end if;
  select * into mp from public.marketplace_profiles where business_id = b.id and listed;
  if not found then return null; end if;
  return jsonb_build_object(
    'slug', b.slug, 'name', b.name, 'timezone', b.timezone, 'phone', b.phone, 'headline', mp.headline, 'about', mp.about, 'mascot', mp.mascot,
    'accepting', mp.accepting_requests,
    'locations', (select coalesce(jsonb_agg(jsonb_build_object('id', l.id, 'name', l.name, 'suburb', coalesce(mp.suburb, l.suburb)) order by l.created_at), '[]') from public.locations l where l.business_id = b.id and l.archived_at is null and not l.is_mobile),
    'hours', (select coalesce(jsonb_agg(jsonb_build_object('weekday', h.weekday, 'opens', to_char(h.opens, 'HH24:MI'), 'closes', to_char(h.closes, 'HH24:MI')) order by h.weekday, h.opens), '[]') from public.location_hours h join public.locations l on l.id = h.location_id where l.business_id = b.id and l.archived_at is null),
    'services', (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'description', s.description, 'category', s.category, 'minutes', s.duration_minutes, 'priceCents', s.base_price_cents, 'priceFrom', s.price_from,
                   'sizePrices', (select coalesce(jsonb_object_agg(r.match_value, r.price_cents), '{}') from public.service_price_rules r where r.service_id = s.id and r.kind = 'size')) order by s.position, s.name), '[]')
                 from public.services s where s.business_id = b.id and s.active and s.bookable_online),
    'policy', (select jsonb_build_object('cancellationHours', p.cancellation_hours, 'text', p.policy_text) from public.booking_policies p where p.business_id = b.id)
  );
end;
$$;
revoke all on function public.marketplace_listings(), public.marketplace_listing(text) from public;
grant execute on function public.marketplace_listings(), public.marketplace_listing(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Booking requests
-- ---------------------------------------------------------------------
create type public.booking_request_status as enum ('draft', 'submitted', 'awaiting_review', 'open', 'accepted', 'confirmed', 'in_progress', 'completed', 'cancelled', 'rejected', 'expired');

create table public.booking_requests (
  id                 uuid primary key default gen_random_uuid(),
  business_id        uuid not null references public.businesses on delete cascade,
  requester_id       uuid not null references auth.users on delete cascade,
  customer_id        uuid not null,
  pet_id             uuid not null,
  location_id        uuid not null,
  status             public.booking_request_status not null default 'submitted',
  preferred_start    timestamptz,
  windows            jsonb not null default '[]'::jsonb check (jsonb_typeof(windows) = 'array' and jsonb_array_length(windows) <= 3),
  notes              text check (notes is null or char_length(notes) <= 1000),
  estimate_cents     integer check (estimate_cents is null or estimate_cents >= 0),
  estimate_from      boolean not null default false,
  estimate_minutes   integer not null check (estimate_minutes between 5 and 720),
  block_minutes      integer not null check (block_minutes between 5 and 800),
  appointment_id     uuid,
  decided_by         uuid references auth.users on delete set null,
  decided_at         timestamptz,
  decision_reason    text check (decision_reason is null or char_length(decision_reason) <= 500),
  accept_deadline    timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (id, business_id),
  check (preferred_start is not null or jsonb_array_length(windows) > 0),
  foreign key (customer_id, business_id) references public.customers (id, business_id),
  foreign key (pet_id, business_id) references public.pets (id, business_id),
  foreign key (pet_id, customer_id) references public.pets (id, customer_id),
  foreign key (location_id, business_id) references public.locations (id, business_id),
  foreign key (appointment_id, business_id) references public.appointments (id, business_id) on delete set null (appointment_id)
);
create index booking_requests_business_status_idx on public.booking_requests (business_id, status, created_at desc);
create index booking_requests_requester_idx on public.booking_requests (requester_id, created_at desc);
create index booking_requests_customer_idx on public.booking_requests (customer_id);
create index booking_requests_pet_idx on public.booking_requests (pet_id);
create index booking_requests_location_idx on public.booking_requests (location_id);
create unique index booking_requests_appointment_uidx on public.booking_requests (appointment_id) where appointment_id is not null;
create trigger booking_requests_touch before update on public.booking_requests for each row execute function public.touch_updated_at();

create table public.booking_request_services (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references public.businesses on delete cascade,
  request_id       uuid not null,
  service_id       uuid,
  name             text not null,
  duration_minutes smallint not null,
  price_cents      integer not null,
  position         smallint not null default 0,
  foreign key (request_id, business_id) references public.booking_requests (id, business_id) on delete cascade,
  foreign key (service_id, business_id) references public.services (id, business_id) on delete set null (service_id)
);
create index booking_request_services_request_idx on public.booking_request_services (request_id);
create index booking_request_services_service_idx on public.booking_request_services (service_id);

create table public.booking_request_events (
  id          bigint generated always as identity primary key,
  business_id uuid not null references public.businesses on delete cascade,
  request_id  uuid not null,
  actor_id    uuid references auth.users on delete set null,
  from_status public.booking_request_status,
  to_status   public.booking_request_status not null,
  note        text check (note is null or char_length(note) <= 500),
  created_at  timestamptz not null default now(),
  foreign key (request_id, business_id) references public.booking_requests (id, business_id) on delete cascade
);
create index booking_request_events_request_idx on public.booking_request_events (request_id, created_at);
create index booking_request_events_business_idx on public.booking_request_events (business_id);

alter table public.booking_requests enable row level security;
alter table public.booking_request_services enable row level security;
alter table public.booking_request_events enable row level security;
-- Staff of the business read its requests; the requester reads their own. All writes go through the functions below.
create policy booking_requests_staff_select on public.booking_requests for select to authenticated using (public.is_business_member(business_id));
create policy booking_requests_requester_select on public.booking_requests for select to authenticated using (requester_id = (select auth.uid()));
create policy booking_request_services_select on public.booking_request_services for select to authenticated
  using (public.is_business_member(business_id) or exists (select 1 from public.booking_requests r where r.id = request_id and r.requester_id = (select auth.uid())));
create policy booking_request_events_select on public.booking_request_events for select to authenticated
  using (public.is_business_member(business_id) or exists (select 1 from public.booking_requests r where r.id = request_id and r.requester_id = (select auth.uid())));
revoke all on public.booking_requests, public.booking_request_services, public.booking_request_events from anon;
revoke insert, update, delete on public.booking_requests, public.booking_request_services, public.booking_request_events from authenticated;
grant select on public.booking_requests, public.booking_request_services, public.booking_request_events to authenticated;

create or replace function public.log_request_event(p_request uuid, p_business uuid, p_from public.booking_request_status, p_to public.booking_request_status, p_note text)
returns void language sql security definer set search_path = '' as $$
  insert into public.booking_request_events (business_id, request_id, actor_id, from_status, to_status, note) values (p_business, p_request, auth.uid(), p_from, p_to, p_note);
$$;
revoke all on function public.log_request_event(uuid, uuid, public.booking_request_status, public.booking_request_status, text) from public, anon, authenticated;

-- Links business customer records to the caller by verified email. Returns how many were linked.
create or replace function public.claim_customer_records()
returns integer language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); mail text; n integer;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select email into mail from auth.users where id = uid and email_confirmed_at is not null;
  if mail is null then return 0; end if;
  update public.customers c set account_user_id = uid, updated_at = now()
  from public.customer_contacts cc
  where cc.customer_id = c.id and cc.business_id = c.business_id and lower(cc.email::text) = lower(mail)
    and c.account_user_id is null and c.archived_at is null
    and not exists (select 1 from public.customers o where o.business_id = c.business_id and o.account_user_id = uid);
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.claim_customer_records() from public, anon;
grant execute on function public.claim_customer_records() to authenticated;

-- A pet owner submits a request for one of their pets at a listed business.
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
  values (b.id, uid, cust, pet, loc, 'awaiting_review', p_preferred_start, coalesce(p_windows, '[]'::jsonb), nullif(btrim(p_notes), ''), 5, 5) returning id into req;
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
  perform public.log_request_event(req, b.id, 'submitted', 'awaiting_review', null);
  return req;
end;
$$;
revoke all on function public.submit_booking_request(text, uuid, uuid[], timestamptz, jsonb, text) from public, anon;
grant execute on function public.submit_booking_request(text, uuid, uuid[], timestamptz, jsonb, text) to authenticated;

-- Front desk confirms (with a groomer and start time, checked against hours and other appointments) or rejects.
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
  update public.booking_requests set status = 'confirmed', appointment_id = appt, decided_by = auth.uid(), decided_at = now() where id = p_id;
  perform public.log_request_event(p_id, r.business_id, r.status, 'confirmed', null);
  return appt;
end;
$$;
revoke all on function public.review_booking_request(uuid, text, uuid, timestamptz, text) from public, anon;
grant execute on function public.review_booking_request(uuid, text, uuid, timestamptz, text) to authenticated;

-- The requester cancels: before confirmation any time; afterwards within the business's cancellation window (the appointment is cancelled too).
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
end;
$$;
revoke all on function public.cancel_booking_request(uuid, text) from public, anon;
grant execute on function public.cancel_booking_request(uuid, text) to authenticated;

-- Appointment progress shows on the request (grooming started, completed, cancelled by the salon).
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
  end if;
  return new;
end;
$$;
create trigger appointments_mirror_request after update of status on public.appointments for each row execute function public.mirror_appointment_on_request();

-- What a pet owner sees: their requests and appointments across businesses (no staff notes, no other customers).
create or replace function public.my_bookings()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'requests', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', r.id, 'status', r.status, 'businessName', b.name, 'businessSlug', b.slug, 'timezone', b.timezone, 'petName', p.name, 'ownerPetId', p.owner_pet_id,
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
revoke all on function public.my_bookings() from public, anon;
grant execute on function public.my_bookings() to authenticated;

-- Favourites by slug (pet owners can't read the businesses table itself).
create or replace function public.toggle_favourite_business(p_slug text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); biz uuid;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select b.id into biz from public.businesses b join public.marketplace_profiles mp on mp.business_id = b.id and mp.listed where b.slug = lower(btrim(p_slug)) and b.status = 'active';
  if biz is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  delete from public.favourite_businesses where user_id = uid and business_id = biz;
  if found then return false; end if;
  insert into public.favourite_businesses (user_id, business_id) values (uid, biz);
  return true;
end;
$$;
create or replace function public.my_favourite_slugs()
returns text[] language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(b.slug order by f.created_at), '{}') from public.favourite_businesses f join public.businesses b on b.id = f.business_id where f.user_id = auth.uid();
$$;
revoke all on function public.toggle_favourite_business(text), public.my_favourite_slugs() from public, anon;
grant execute on function public.toggle_favourite_business(text), public.my_favourite_slugs() to authenticated;
