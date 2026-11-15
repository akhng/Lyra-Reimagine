-- Personal dashboard layouts (transformation R2, ADR 0003): each person keeps
-- their own tile order, sizes, pins and hidden tiles per business. Only the
-- person can read or change their layout, and only while they are a member.

create table public.dashboard_layouts (
  user_id     uuid not null references auth.users (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  layout      jsonb not null default '{}'::jsonb check (jsonb_typeof(layout) = 'object' and octet_length(layout::text) <= 4000),
  updated_at  timestamptz not null default now(),
  primary key (user_id, business_id)
);
create index dashboard_layouts_business_idx on public.dashboard_layouts (business_id);
alter table public.dashboard_layouts enable row level security;

create policy dashboard_layouts_own_select on public.dashboard_layouts for select to authenticated
  using (user_id = (select auth.uid()) and public.is_business_member(business_id));
create policy dashboard_layouts_own_insert on public.dashboard_layouts for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_business_member(business_id));
create policy dashboard_layouts_own_update on public.dashboard_layouts for update to authenticated
  using (user_id = (select auth.uid()) and public.is_business_member(business_id))
  with check (user_id = (select auth.uid()) and public.is_business_member(business_id));
create policy dashboard_layouts_own_delete on public.dashboard_layouts for delete to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.dashboard_layouts from anon;
grant select, insert, update, delete on public.dashboard_layouts to authenticated;
