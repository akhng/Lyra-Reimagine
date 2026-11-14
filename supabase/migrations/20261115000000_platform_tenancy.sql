-- Lyra Reimagine platform foundation (ADR 0001, 0002).
-- Tenancy: every business-owned row carries business_id; Row Level Security
-- allows access only to active members of that business, by role. The
-- frontend never filters for security.

create extension if not exists citext with schema extensions;

create type public.business_role as enum ('owner', 'manager', 'receptionist', 'groomer');
create type public.member_status as enum ('active', 'invited', 'suspended');
create type public.business_status as enum ('active', 'suspended', 'closed');
create type public.plan_tier as enum ('starter', 'growth', 'pro');

-- People who sign in (business staff). Customers of businesses get their own model later.
create table public.profiles (
  id          uuid primary key references auth.users on delete cascade,
  full_name   text check (full_name is null or char_length(full_name) between 1 and 120),
  phone       text check (phone is null or char_length(phone) between 6 and 30),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy profiles_select_self on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy profiles_update_self on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name) values (new.id, nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''));
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Tenants.
create table public.businesses (
  id              uuid primary key default gen_random_uuid(),
  product         text not null default 'pet' check (product in ('pet', 'salon', 'trade', 'clean')),
  name            text not null check (char_length(name) between 2 and 120),
  slug            extensions.citext not null unique check (slug ~ '^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){2,39}$'),
  timezone        text not null default 'Australia/Melbourne',
  currency        char(3) not null default 'AUD' check (currency ~ '^[A-Z]{3}$'),
  country_code    char(2) not null default 'AU',
  abn             text check (abn is null or abn ~ '^[0-9]{11}$'),
  gst_registered  boolean not null default false,
  phone           text check (phone is null or char_length(phone) between 6 and 30),
  email           extensions.citext,
  plan            public.plan_tier not null default 'starter',
  status          public.business_status not null default 'active',
  created_by      uuid references auth.users on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table public.business_members (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses on delete cascade,
  user_id      uuid not null references auth.users on delete cascade,
  role         public.business_role not null,
  status       public.member_status not null default 'active',
  display_name text check (display_name is null or char_length(display_name) between 1 and 80),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (business_id, user_id)
);
create index business_members_user_idx on public.business_members (user_id, status);

create table public.locations (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses on delete cascade,
  name         text not null check (char_length(name) between 1 and 80),
  address_line text check (address_line is null or char_length(address_line) <= 200),
  suburb       text check (suburb is null or char_length(suburb) <= 80),
  state        text check (state is null or char_length(state) <= 40),
  postcode     text check (postcode is null or postcode ~ '^[0-9]{4}$'),
  phone        text check (phone is null or char_length(phone) between 6 and 30),
  timezone     text,
  is_mobile    boolean not null default false,
  archived_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (id, business_id)
);
create index locations_business_idx on public.locations (business_id) where archived_at is null;

-- Who did what inside a business (privileged and settings changes). Never contains customer details.
create table public.audit_log (
  id           bigint generated always as identity primary key,
  business_id  uuid references public.businesses on delete cascade,
  actor_id     uuid references auth.users on delete set null,
  action       text not null check (char_length(action) between 3 and 80),
  entity       text,
  entity_id    text,
  created_at   timestamptz not null default now()
);
create index audit_log_business_idx on public.audit_log (business_id, created_at desc);

-- Membership checks used by every policy. Security definer so policies on
-- business_members itself don't recurse; they only ever look at the caller.
create or replace function public.is_business_member(p_business uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.business_members m where m.business_id = p_business and m.user_id = (select auth.uid()) and m.status = 'active');
$$;

create or replace function public.has_business_role(p_business uuid, p_roles public.business_role[])
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.business_members m where m.business_id = p_business and m.user_id = (select auth.uid()) and m.status = 'active' and m.role = any (p_roles));
$$;

alter table public.businesses enable row level security;
alter table public.business_members enable row level security;
alter table public.locations enable row level security;
alter table public.audit_log enable row level security;

create policy businesses_select_member on public.businesses for select to authenticated using (public.is_business_member(id));
create policy businesses_update_admin on public.businesses for update to authenticated
  using (public.has_business_role(id, array['owner', 'manager']::public.business_role[]))
  with check (public.has_business_role(id, array['owner', 'manager']::public.business_role[]));
-- Businesses are created only through create_business(); plan and status change only on the platform side.
revoke insert, delete on public.businesses from authenticated, anon;
-- Column-level: members may edit details, never plan, status, product, owner or slug.
revoke update on public.businesses from authenticated, anon;
grant update (name, timezone, abn, gst_registered, phone, email) on public.businesses to authenticated;

create policy members_select_same_business on public.business_members for select to authenticated using (public.is_business_member(business_id));
-- Membership changes go through functions (invites, role changes) in Phase 4.
revoke insert, update, delete on public.business_members from authenticated, anon;

create policy locations_select_member on public.locations for select to authenticated using (public.is_business_member(business_id));
create policy locations_insert_admin on public.locations for insert to authenticated with check (public.has_business_role(business_id, array['owner', 'manager']::public.business_role[]));
create policy locations_update_admin on public.locations for update to authenticated
  using (public.has_business_role(business_id, array['owner', 'manager']::public.business_role[]))
  with check (public.has_business_role(business_id, array['owner', 'manager']::public.business_role[]));
revoke delete on public.locations from authenticated, anon;

create policy audit_select_admin on public.audit_log for select to authenticated using (public.has_business_role(business_id, array['owner', 'manager']::public.business_role[]));
revoke insert, update, delete on public.audit_log from authenticated, anon;

-- Creates a business, its owner membership and first location atomically.
-- Returns the new business id. Errors: slug_taken, slug_invalid.
create or replace function public.create_business(p_name text, p_slug text, p_timezone text, p_location_name text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  bid uuid;
  reserved text[] := array['admin','api','app','auth','b','book','billing','dashboard','help','login','logout','onboarding','settings','signup','support','www','lyra','pet','platform'];
begin
  if uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if p_slug !~ '^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){2,39}$' or p_slug = any (reserved) then
    raise exception 'slug_invalid' using errcode = '22023';
  end if;
  if not exists (select 1 from pg_timezone_names where name = p_timezone) then
    raise exception 'timezone_invalid' using errcode = '22023';
  end if;
  -- Guard against runaway sign-ups: at most 5 businesses created per user.
  if (select count(*) from public.businesses b where b.created_by = uid) >= 5 then
    raise exception 'limit_reached' using errcode = '54000';
  end if;
  begin
    insert into public.businesses (name, slug, timezone, created_by) values (trim(p_name), p_slug, p_timezone, uid) returning id into bid;
  exception when unique_violation then
    raise exception 'slug_taken' using errcode = '23505';
  end;
  insert into public.business_members (business_id, user_id, role, display_name)
  values (bid, uid, 'owner', (select p.full_name from public.profiles p where p.id = uid));
  insert into public.locations (business_id, name, timezone) values (bid, coalesce(nullif(trim(p_location_name), ''), 'Main location'), p_timezone);
  insert into public.audit_log (business_id, actor_id, action, entity, entity_id) values (bid, uid, 'business.created', 'business', bid::text);
  return bid;
end;
$$;
revoke all on function public.create_business(text, text, text, text) from public, anon;
grant execute on function public.create_business(text, text, text, text) to authenticated;

-- Slug availability for the sign-up form (true when free and valid). Reveals nothing else.
create or replace function public.business_slug_available(p_slug text)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_slug ~ '^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){2,39}$' and not exists (select 1 from public.businesses b where lower(b.slug::text) = lower(p_slug));
$$;
revoke all on function public.business_slug_available(text) from public, anon;
grant execute on function public.business_slug_available(text) to authenticated;

revoke all on function public.is_business_member(uuid), public.has_business_role(uuid, public.business_role[]) from public, anon;
grant execute on function public.is_business_member(uuid), public.has_business_role(uuid, public.business_role[]) to authenticated;

-- updated_at maintenance.
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger businesses_touch before update on public.businesses for each row execute function public.touch_updated_at();
create trigger business_members_touch before update on public.business_members for each row execute function public.touch_updated_at();
create trigger locations_touch before update on public.locations for each row execute function public.touch_updated_at();
