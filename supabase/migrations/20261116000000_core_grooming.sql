-- Lyra Pet Phase 2: customers, pets, services and pricing, grooming records and photos.
-- Every table: business_id + RLS. Cross-table links use composite keys (id, business_id)
-- so a row can never point into another business.
-- Who can do what:
--   customers            read: all staff · write: owner, manager, receptionist
--   customer_contacts    read/write: owner, manager, receptionist (groomers never see contact details)
--   pets                 read/write: all staff (groomers keep grooming preferences up to date)
--   services, pricing    read: all staff · write: owner, manager
--   grooming_records     read/insert: all staff · update: its author, owner, manager
--   grooming_photos      read/insert: all staff · delete: uploader, owner, manager

alter table public.business_members add constraint business_members_id_business_key unique (id, business_id);

create type public.contact_method as enum ('email', 'sms', 'phone');
create type public.pet_species as enum ('dog', 'cat', 'other');
create type public.pet_sex as enum ('male', 'female', 'unknown');
create type public.pet_size as enum ('toy', 'small', 'medium', 'large', 'giant');
create type public.price_rule_kind as enum ('size', 'breed', 'coat_condition');
create type public.photo_kind as enum ('before', 'after');

create table public.customers (
  id                   uuid primary key default gen_random_uuid(),
  business_id          uuid not null references public.businesses on delete cascade,
  first_name           text not null check (char_length(first_name) between 1 and 80),
  last_name            text check (last_name is null or char_length(last_name) <= 80),
  preferred_contact    public.contact_method not null default 'sms',
  preferred_groomer_id uuid,
  notes                text check (notes is null or char_length(notes) <= 4000),
  is_vip               boolean not null default false,
  marketing_consent    boolean not null default false,
  marketing_consent_at timestamptz,
  photo_path           text,
  archived_at          timestamptz,
  created_by           uuid references auth.users on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (id, business_id),
  foreign key (preferred_groomer_id, business_id) references public.business_members (id, business_id) on delete set null (preferred_groomer_id)
);
create index customers_business_idx on public.customers (business_id, created_at desc) where archived_at is null;
create index customers_name_idx on public.customers (business_id, lower(first_name), lower(last_name));

-- Contact details live apart so Row Level Security can hide them from groomers.
create table public.customer_contacts (
  customer_id  uuid primary key,
  business_id  uuid not null references public.businesses on delete cascade,
  email        extensions.citext check (email is null or char_length(email::text) <= 254),
  mobile       text check (mobile is null or mobile ~ '^\+?[0-9 ]{6,20}$'),
  address_line text check (address_line is null or char_length(address_line) <= 200),
  suburb       text check (suburb is null or char_length(suburb) <= 80),
  state        text check (state is null or state in ('NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT')),
  postcode     text check (postcode is null or postcode ~ '^[0-9]{4}$'),
  updated_at   timestamptz not null default now(),
  foreign key (customer_id, business_id) references public.customers (id, business_id) on delete cascade
);
create index customer_contacts_business_idx on public.customer_contacts (business_id);
create index customer_contacts_mobile_idx on public.customer_contacts (business_id, (regexp_replace(mobile, '[^0-9]', '', 'g')));

create table public.pets (
  id                    uuid primary key default gen_random_uuid(),
  business_id           uuid not null references public.businesses on delete cascade,
  customer_id           uuid not null,
  name                  text not null check (char_length(name) between 1 and 60),
  species               public.pet_species not null default 'dog',
  breed                 text check (breed is null or char_length(breed) <= 80),
  size                  public.pet_size,
  date_of_birth         date,
  estimated_age_years   numeric(4,1) check (estimated_age_years is null or estimated_age_years between 0 and 40),
  sex                   public.pet_sex not null default 'unknown',
  desexed               boolean,
  weight_kg             numeric(5,2) check (weight_kg is null or weight_kg between 0 and 150),
  coat_type             text check (coat_type is null or char_length(coat_type) <= 60),
  coat_colour           text check (coat_colour is null or char_length(coat_colour) <= 60),
  microchip             text check (microchip is null or microchip ~ '^[0-9A-Za-z]{9,20}$'),
  photo_path            text,
  groom_interval_weeks  smallint check (groom_interval_weeks is null or groom_interval_weeks between 1 and 52),
  -- Grooming preferences
  preferred_cut         text check (preferred_cut is null or char_length(preferred_cut) <= 200),
  coat_length           text check (coat_length is null or char_length(coat_length) <= 100),
  grooming_style        text check (grooming_style is null or char_length(grooming_style) <= 200),
  shampoo               text check (shampoo is null or char_length(shampoo) <= 120),
  finishing_products    text check (finishing_products is null or char_length(finishing_products) <= 200),
  nail_preferences      text check (nail_preferences is null or char_length(nail_preferences) <= 200),
  ear_cleaning          text check (ear_cleaning is null or char_length(ear_cleaning) <= 200),
  behaviour             text check (behaviour is null or char_length(behaviour) <= 1000),
  noise_sensitivity     text check (noise_sensitivity is null or char_length(noise_sensitivity) <= 200),
  handling_preferences  text check (handling_preferences is null or char_length(handling_preferences) <= 1000),
  -- Care information reported by the owner (recorded as given; never inferred)
  allergies             text check (allergies is null or char_length(allergies) <= 1000),
  sensitivities         text check (sensitivities is null or char_length(sensitivities) <= 1000),
  medical_notes         text check (medical_notes is null or char_length(medical_notes) <= 2000),
  skin_coat_concerns    text check (skin_coat_concerns is null or char_length(skin_coat_concerns) <= 1000),
  handling_precautions  text check (handling_precautions is null or char_length(handling_precautions) <= 1000),
  emergency_contact     text check (emergency_contact is null or char_length(emergency_contact) <= 200),
  archived_at           timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (id, business_id),
  foreign key (customer_id, business_id) references public.customers (id, business_id) on delete cascade
);
create index pets_customer_idx on public.pets (customer_id);
create index pets_business_name_idx on public.pets (business_id, lower(name)) where archived_at is null;

create table public.services (
  id                uuid primary key default gen_random_uuid(),
  business_id       uuid not null references public.businesses on delete cascade,
  name              text not null check (char_length(name) between 1 and 80),
  description       text check (description is null or char_length(description) <= 1000),
  category          text check (category is null or char_length(category) <= 60),
  duration_minutes  smallint not null check (duration_minutes between 5 and 600),
  buffer_minutes    smallint not null default 0 check (buffer_minutes between 0 and 120),
  base_price_cents  integer not null check (base_price_cents between 0 and 10000000),
  price_from        boolean not null default false,
  bookable_online   boolean not null default true,
  active            boolean not null default true,
  position          integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (id, business_id)
);
create index services_business_idx on public.services (business_id, position) where active;

-- Size and breed rules set the price; coat-condition rules add a surcharge.
create table public.service_price_rules (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references public.businesses on delete cascade,
  service_id    uuid not null,
  kind          public.price_rule_kind not null,
  match_value   text not null check (char_length(match_value) between 1 and 80),
  price_cents   integer not null check (price_cents between 0 and 10000000),
  created_at    timestamptz not null default now(),
  unique (service_id, kind, match_value),
  foreign key (service_id, business_id) references public.services (id, business_id) on delete cascade
);
create index service_price_rules_service_idx on public.service_price_rules (service_id);

create table public.grooming_records (
  id                     uuid primary key default gen_random_uuid(),
  business_id            uuid not null references public.businesses on delete cascade,
  pet_id                 uuid not null,
  groomed_on             date not null,
  groomer_id             uuid,
  service_ids            uuid[] not null default '{}',
  services_summary       text check (services_summary is null or char_length(services_summary) <= 300),
  duration_minutes       smallint check (duration_minutes is null or duration_minutes between 1 and 720),
  haircut                text check (haircut is null or char_length(haircut) <= 300),
  shampoo                text check (shampoo is null or char_length(shampoo) <= 120),
  customer_instructions  text check (customer_instructions is null or char_length(customer_instructions) <= 2000),
  observations           text check (observations is null or char_length(observations) <= 2000),
  customer_feedback      text check (customer_feedback is null or char_length(customer_feedback) <= 2000),
  created_by             uuid references auth.users on delete set null default auth.uid(),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (id, business_id),
  foreign key (pet_id, business_id) references public.pets (id, business_id) on delete cascade,
  foreign key (groomer_id, business_id) references public.business_members (id, business_id) on delete set null (groomer_id)
);
create index grooming_records_pet_idx on public.grooming_records (pet_id, groomed_on desc);
create index grooming_records_business_idx on public.grooming_records (business_id, groomed_on desc);

create table public.grooming_photos (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references public.businesses on delete cascade,
  record_id     uuid not null,
  kind          public.photo_kind not null,
  storage_path  text not null unique check (storage_path ~ '^[0-9a-f-]{36}/grooming/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'),
  uploaded_by   uuid references auth.users on delete set null default auth.uid(),
  created_at    timestamptz not null default now(),
  foreign key (record_id, business_id) references public.grooming_records (id, business_id) on delete cascade
);
create index grooming_photos_record_idx on public.grooming_photos (record_id);
create index grooming_photos_business_idx on public.grooming_photos (business_id);

alter table public.customers enable row level security;
alter table public.customer_contacts enable row level security;
alter table public.pets enable row level security;
alter table public.services enable row level security;
alter table public.service_price_rules enable row level security;
alter table public.grooming_records enable row level security;
alter table public.grooming_photos enable row level security;

-- customers
create policy customers_select on public.customers for select to authenticated using (public.is_business_member(business_id));
create policy customers_insert on public.customers for insert to authenticated with check (public.has_business_role(business_id, array['owner','manager','receptionist']::public.business_role[]));
create policy customers_update on public.customers for update to authenticated
  using (public.has_business_role(business_id, array['owner','manager','receptionist']::public.business_role[]))
  with check (public.has_business_role(business_id, array['owner','manager','receptionist']::public.business_role[]));
-- customer_contacts
create policy contacts_select on public.customer_contacts for select to authenticated using (public.has_business_role(business_id, array['owner','manager','receptionist']::public.business_role[]));
create policy contacts_insert on public.customer_contacts for insert to authenticated with check (public.has_business_role(business_id, array['owner','manager','receptionist']::public.business_role[]));
create policy contacts_update on public.customer_contacts for update to authenticated
  using (public.has_business_role(business_id, array['owner','manager','receptionist']::public.business_role[]))
  with check (public.has_business_role(business_id, array['owner','manager','receptionist']::public.business_role[]));
-- pets
create policy pets_select on public.pets for select to authenticated using (public.is_business_member(business_id));
create policy pets_insert on public.pets for insert to authenticated with check (public.is_business_member(business_id));
create policy pets_update on public.pets for update to authenticated using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));
-- services and pricing
create policy services_select on public.services for select to authenticated using (public.is_business_member(business_id));
create policy services_write on public.services for all to authenticated
  using (public.has_business_role(business_id, array['owner','manager']::public.business_role[]))
  with check (public.has_business_role(business_id, array['owner','manager']::public.business_role[]));
create policy price_rules_select on public.service_price_rules for select to authenticated using (public.is_business_member(business_id));
create policy price_rules_write on public.service_price_rules for all to authenticated
  using (public.has_business_role(business_id, array['owner','manager']::public.business_role[]))
  with check (public.has_business_role(business_id, array['owner','manager']::public.business_role[]));
-- grooming records
create policy records_select on public.grooming_records for select to authenticated using (public.is_business_member(business_id));
create policy records_insert on public.grooming_records for insert to authenticated with check (public.is_business_member(business_id) and created_by = (select auth.uid()));
create policy records_update on public.grooming_records for update to authenticated
  using (public.is_business_member(business_id) and (created_by = (select auth.uid()) or public.has_business_role(business_id, array['owner','manager']::public.business_role[])))
  with check (public.is_business_member(business_id));
-- grooming photos
create policy photos_select on public.grooming_photos for select to authenticated using (public.is_business_member(business_id));
create policy photos_insert on public.grooming_photos for insert to authenticated with check (public.is_business_member(business_id) and uploaded_by = (select auth.uid()) and split_part(storage_path, '/', 1) = business_id::text);
create policy photos_delete on public.grooming_photos for delete to authenticated
  using (public.is_business_member(business_id) and (uploaded_by = (select auth.uid()) or public.has_business_role(business_id, array['owner','manager']::public.business_role[])));

-- Hard deletes of customers and pets go through archiving (and account deletion requests, later).
revoke delete on public.customers, public.customer_contacts, public.pets, public.grooming_records from authenticated, anon;

-- Private media bucket. Paths start with the business id: <business_id>/grooming/<record_id>/<photo_id>.<ext>
-- and <business_id>/pets/<pet_id>/<photo_id>.<ext>. Only members of that business can read or upload.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', false, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create or replace function public.media_business(p_name text)
returns uuid language sql immutable set search_path = '' as $$
  select case when split_part(p_name, '/', 1) ~ '^[0-9a-f-]{36}$' then split_part(p_name, '/', 1)::uuid end;
$$;

create policy media_select on storage.objects for select to authenticated using (bucket_id = 'media' and public.is_business_member(public.media_business(name)));
create policy media_insert on storage.objects for insert to authenticated with check (bucket_id = 'media' and public.is_business_member(public.media_business(name)));
create policy media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'media' and public.has_business_role(public.media_business(name), array['owner','manager']::public.business_role[]));

-- Customer list with grooming activity, for search and segments. Invoker: RLS applies,
-- so contact matches only work for roles allowed to see contact details.
create or replace function public.customer_directory(p_business uuid, p_query text default null)
returns table (
  id uuid, first_name text, last_name text, is_vip boolean, created_at timestamptz,
  pet_names text[], groom_count bigint, last_groomed_on date, next_due_on date
) language sql stable security invoker set search_path = '' as $$
  with q as (select nullif(trim(p_query), '') as text, nullif(regexp_replace(coalesce(p_query, ''), '[^0-9]', '', 'g'), '') as digits)
  select c.id, c.first_name, c.last_name, c.is_vip, c.created_at,
         coalesce((select array_agg(p.name order by p.name) from public.pets p where p.customer_id = c.id and p.archived_at is null), '{}'),
         (select count(*) from public.grooming_records r join public.pets p on p.id = r.pet_id where p.customer_id = c.id),
         (select max(r.groomed_on) from public.grooming_records r join public.pets p on p.id = r.pet_id where p.customer_id = c.id),
         (select min(last_groom + (p.groom_interval_weeks * 7))
            from public.pets p
            cross join lateral (select max(r.groomed_on) as last_groom from public.grooming_records r where r.pet_id = p.id) lg
           where p.customer_id = c.id and p.archived_at is null and p.groom_interval_weeks is not null and lg.last_groom is not null)
  from public.customers c, q
  where c.business_id = p_business and c.archived_at is null
    and (q.text is null
         or (c.first_name || ' ' || coalesce(c.last_name, '')) ilike '%' || q.text || '%'
         or exists (select 1 from public.pets p where p.customer_id = c.id and p.name ilike '%' || q.text || '%')
         or exists (select 1 from public.customer_contacts cc where cc.customer_id = c.id
                    and (cc.email::text ilike '%' || q.text || '%'
                         or (q.digits is not null and length(q.digits) >= 4 and regexp_replace(coalesce(cc.mobile, ''), '[^0-9]', '', 'g') like '%' || q.digits || '%'))))
  order by c.first_name, c.last_name
  limit 200;
$$;
revoke all on function public.customer_directory(uuid, text) from public, anon;
grant execute on function public.customer_directory(uuid, text) to authenticated;

create trigger customers_touch before update on public.customers for each row execute function public.touch_updated_at();
create trigger customer_contacts_touch before update on public.customer_contacts for each row execute function public.touch_updated_at();
create trigger pets_touch before update on public.pets for each row execute function public.touch_updated_at();
create trigger services_touch before update on public.services for each row execute function public.touch_updated_at();
create trigger grooming_records_touch before update on public.grooming_records for each row execute function public.touch_updated_at();
