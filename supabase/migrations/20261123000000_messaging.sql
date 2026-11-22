-- Private messages between pet owners and salons (ADR 0005).
--
-- * One conversation per pet owner and salon, started by the owner from the
--   salon's listing, with or without a booking.
-- * The salon side is the front desk (owner, manager, receptionist) plus any
--   groomer with a current booking for that owner (an appointment from the
--   last 30 days or later, or a request assigned to or accepted by them).
--   Owners and managers can read every conversation; the owner is told so.
-- * Staff never see the owner's email or phone, only a first name.
-- * Phone numbers, emails and links are hidden in messages until the owner
--   has paid for a booking through the app (or, at salons that don't take
--   online payments, has a confirmed or completed appointment). Masking
--   happens here, on the server, so no client can skip it.
-- * Writes go through security definer functions that check auth.uid().
--   Message text is never logged.

create table public.chat_conversations (
  id                    uuid primary key default gen_random_uuid(),
  business_id           uuid not null references public.businesses on delete cascade,
  customer_user_id      uuid not null references auth.users on delete cascade,
  customer_name         text not null check (char_length(customer_name) between 1 and 80),
  created_at            timestamptz not null default now(),
  last_message_at       timestamptz,
  customer_last_read_at timestamptz,
  blocked_by            text check (blocked_by in ('customer', 'business')),
  blocked_at            timestamptz,
  unique (business_id, customer_user_id),
  unique (id, business_id)
);
create index chat_conversations_customer_idx on public.chat_conversations (customer_user_id, last_message_at desc);
create index chat_conversations_business_idx on public.chat_conversations (business_id, last_message_at desc);

create table public.chat_messages (
  id              bigint generated always as identity primary key,
  conversation_id uuid not null,
  business_id     uuid not null,
  sender_kind     text not null check (sender_kind in ('customer', 'staff')),
  sender_user_id  uuid references auth.users on delete set null,
  sender_name     text not null check (char_length(sender_name) between 1 and 80),
  body            text not null check (char_length(body) between 1 and 2000),
  masked          boolean not null default false,
  created_at      timestamptz not null default now(),
  foreign key (conversation_id, business_id) references public.chat_conversations (id, business_id) on delete cascade
);
create index chat_messages_conversation_idx on public.chat_messages (conversation_id, created_at desc);
create index chat_messages_business_idx on public.chat_messages (business_id);
create index chat_messages_sender_idx on public.chat_messages (sender_user_id, created_at desc);

create table public.chat_staff_reads (
  conversation_id uuid not null,
  business_id     uuid not null,
  member_id       uuid not null,
  last_read_at    timestamptz not null default now(),
  primary key (conversation_id, member_id),
  foreign key (conversation_id, business_id) references public.chat_conversations (id, business_id) on delete cascade,
  foreign key (member_id, business_id) references public.business_members (id, business_id) on delete cascade
);
create index chat_staff_reads_business_idx on public.chat_staff_reads (business_id);
create index chat_staff_reads_member_idx on public.chat_staff_reads (member_id, business_id);

create table public.chat_reports (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null,
  business_id      uuid not null,
  reporter_kind    text not null check (reporter_kind in ('customer', 'staff')),
  reporter_user_id uuid references auth.users on delete set null,
  reason           text check (reason is null or char_length(reason) <= 500),
  created_at       timestamptz not null default now(),
  resolved_at      timestamptz,
  foreign key (conversation_id, business_id) references public.chat_conversations (id, business_id) on delete cascade
);
create index chat_reports_conversation_idx on public.chat_reports (conversation_id, business_id);
create index chat_reports_business_idx on public.chat_reports (business_id, resolved_at);
create index chat_reports_reporter_idx on public.chat_reports (reporter_user_id, created_at desc);

-- ---------------------------------------------------------------------
-- Access
-- ---------------------------------------------------------------------

-- The caller's active membership in a business, if any.
create or replace function public.my_member(p_business uuid)
returns table (id uuid, role public.business_role, display_name text)
language sql stable security definer set search_path = '' as $$
  select m.id, m.role, m.display_name from public.business_members m
   where m.business_id = p_business and m.user_id = (select auth.uid()) and m.status = 'active';
$$;

-- Salon-side access: front desk always; a groomer while they have a current booking for this owner.
create or replace function public.chat_staff_access(p_conversation uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
      from public.chat_conversations c
      join public.business_members m on m.business_id = c.business_id and m.user_id = (select auth.uid()) and m.status = 'active'
     where c.id = p_conversation
       and (m.role in ('owner', 'manager', 'receptionist')
            or exists (select 1 from public.appointments a join public.customers cu on cu.id = a.customer_id and cu.business_id = a.business_id
                        where a.business_id = c.business_id and a.groomer_id = m.id and cu.account_user_id = c.customer_user_id
                          and a.status not in ('cancelled', 'no_show') and a.starts_at > now() - interval '30 days')
            or exists (select 1 from public.booking_requests r
                        where r.business_id = c.business_id and r.requester_id = c.customer_user_id
                          and (r.assigned_groomer_id = m.id or r.accepted_by = m.id)
                          and r.status in ('open', 'accepted', 'confirmed', 'in_progress')))
  );
$$;

create or replace function public.chat_can_read(p_conversation uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.chat_conversations c where c.id = p_conversation and c.customer_user_id = (select auth.uid()))
      or public.chat_staff_access(p_conversation);
$$;
revoke all on function public.my_member(uuid), public.chat_staff_access(uuid), public.chat_can_read(uuid) from public, anon;
grant execute on function public.my_member(uuid), public.chat_staff_access(uuid), public.chat_can_read(uuid) to authenticated;

alter table public.chat_conversations enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_staff_reads enable row level security;
alter table public.chat_reports enable row level security;

create policy chat_conversations_read on public.chat_conversations for select to authenticated using (public.chat_can_read(id));
create policy chat_messages_read on public.chat_messages for select to authenticated using (public.chat_can_read(conversation_id));
create policy chat_staff_reads_own on public.chat_staff_reads for select to authenticated
  using (member_id in (select m.id from public.business_members m where m.user_id = (select auth.uid())));
-- Reports: owners and managers of the salon, and whoever reported.
create policy chat_reports_read on public.chat_reports for select to authenticated
  using (reporter_user_id = (select auth.uid()) or public.has_business_role(business_id, array['owner', 'manager']::public.business_role[]));

-- No direct writes: everything goes through the functions below.
revoke all on public.chat_conversations, public.chat_messages, public.chat_staff_reads, public.chat_reports from anon, authenticated;
grant select on public.chat_conversations, public.chat_messages, public.chat_staff_reads, public.chat_reports to authenticated;

-- ---------------------------------------------------------------------
-- Contact details: hidden until the owner has paid through the app
-- ---------------------------------------------------------------------

create or replace function public.mask_contact_details(p_body text)
returns text language sql immutable set search_path = '' as $$
  select regexp_replace(
           regexp_replace(
             regexp_replace(
               regexp_replace(p_body,
                 '[A-Za-z0-9._%+-]+\s*(@|\(at\)|\[at\])\s*[A-Za-z0-9-]+(\s*(\.|\(dot\)|\[dot\])\s*[A-Za-z0-9-]+)+', '[contact hidden]', 'gi'),
               '(https?://|www\.)\S+', '[link hidden]', 'gi'),
             '\m[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.(com|net|org|io|co|me|biz|info|app|shop|au)(\.[a-z]{2})?\M(/\S*)?', '[link hidden]', 'gi'),
           '\+?\(?\d(?:[\s().-]*\d){7,}', '[number hidden]', 'g');
$$;

create or replace function public.chat_contact_unlocked(p_conversation uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.chat_conversations c
     where c.id = p_conversation
       and (exists (select 1 from public.payments p join public.customers cu on cu.id = p.customer_id and cu.business_id = p.business_id
                     where p.business_id = c.business_id and cu.account_user_id = c.customer_user_id and p.status = 'paid')
            or (not public.payments_enabled(c.business_id)
                and exists (select 1 from public.appointments a join public.customers cu on cu.id = a.customer_id and cu.business_id = a.business_id
                             where a.business_id = c.business_id and cu.account_user_id = c.customer_user_id
                               and a.status in ('confirmed', 'checked_in', 'in_progress', 'completed'))))
  );
$$;
revoke all on function public.chat_contact_unlocked(uuid) from public, anon;
grant execute on function public.chat_contact_unlocked(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Writes
-- ---------------------------------------------------------------------

-- A pet owner starts (or reopens) their conversation with a listed salon.
create or replace function public.start_conversation(p_slug text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); biz uuid; first_name text; conv uuid;
begin
  if uid is null then raise exception 'not_signed_in' using errcode = '42501'; end if;
  select b.id into biz from public.businesses b
    where b.slug = lower(btrim(p_slug)) and b.status = 'active'
      and (exists (select 1 from public.marketplace_profiles mp where mp.business_id = b.id and mp.listed)
           or exists (select 1 from public.customers cu where cu.business_id = b.id and cu.account_user_id = uid));
  if biz is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if exists (select 1 from public.business_members m where m.business_id = biz and m.user_id = uid) then
    raise exception 'own_business' using errcode = '22023';
  end if;
  select id into conv from public.chat_conversations where business_id = biz and customer_user_id = uid;
  if conv is not null then return conv; end if;
  -- Staff see a first name only (never an email or phone number).
  select coalesce(nullif(split_part(btrim(p.full_name), ' ', 1), ''), 'Pet owner') into first_name from public.profiles p where p.id = uid;
  insert into public.chat_conversations (business_id, customer_user_id, customer_name)
  values (biz, uid, left(coalesce(first_name, 'Pet owner'), 80))
  on conflict (business_id, customer_user_id) do nothing returning id into conv;
  if conv is null then select id into conv from public.chat_conversations where business_id = biz and customer_user_id = uid; end if;
  return conv;
end;
$$;

create or replace function public.send_chat_message(p_conversation uuid, p_body text)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid(); c record; kind text; sender text; member uuid; clean text; shown text; msg bigint;
  b record; hour_key text;
begin
  select * into c from public.chat_conversations where id = p_conversation for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if c.customer_user_id = uid then
    kind := 'customer'; sender := c.customer_name;
  elsif public.chat_staff_access(p_conversation) then
    kind := 'staff';
    select m.id, coalesce(nullif(split_part(btrim(m.display_name), ' ', 1), ''), 'The team') into member, sender from public.my_member(c.business_id) m;
  else
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if c.blocked_by is not null then raise exception 'blocked' using errcode = '22023'; end if;
  clean := btrim(coalesce(p_body, ''));
  if char_length(clean) < 1 or char_length(clean) > 2000 then raise exception 'invalid_message' using errcode = '22023'; end if;
  -- Fair use: 10 a minute and 300 a day per person.
  if (select count(*) from public.chat_messages where sender_user_id = uid and created_at > now() - interval '1 minute') >= 10
     or (select count(*) from public.chat_messages where sender_user_id = uid and created_at > now() - interval '1 day') >= 300 then
    raise exception 'rate_limited' using errcode = '22023';
  end if;
  shown := case when public.chat_contact_unlocked(p_conversation) then clean else public.mask_contact_details(clean) end;
  insert into public.chat_messages (conversation_id, business_id, sender_kind, sender_user_id, sender_name, body, masked)
  values (c.id, c.business_id, kind, uid, sender, shown, shown <> clean) returning id into msg;
  update public.chat_conversations set last_message_at = now(), customer_last_read_at = case when kind = 'customer' then now() else customer_last_read_at end where id = c.id;
  if kind = 'staff' then
    insert into public.chat_staff_reads (conversation_id, business_id, member_id, last_read_at) values (c.id, c.business_id, member, now())
    on conflict (conversation_id, member_id) do update set last_read_at = now();
  end if;

  -- At most one notification per conversation, recipient and hour.
  hour_key := 'chat:' || c.id || ':' || to_char(date_trunc('hour', now()), 'YYYYMMDDHH24');
  select bz.name as bname, bz.slug into b from public.businesses bz where bz.id = c.business_id;
  if kind = 'customer' then
    perform public.notify(m.user_id, c.business_id, 'staff', 'message_new', jsonb_build_object('conversationId', c.id, 'customerName', c.customer_name), hour_key)
       from public.business_members m
      where m.business_id = c.business_id and m.status = 'active' and m.user_id is distinct from uid
        and (m.role in ('owner', 'manager', 'receptionist')
             or exists (select 1 from public.appointments a join public.customers cu on cu.id = a.customer_id and cu.business_id = a.business_id
                         where a.business_id = c.business_id and a.groomer_id = m.id and cu.account_user_id = c.customer_user_id
                           and a.status not in ('cancelled', 'no_show') and a.starts_at > now() - interval '30 days')
             or exists (select 1 from public.booking_requests r where r.business_id = c.business_id and r.requester_id = c.customer_user_id
                         and (r.assigned_groomer_id = m.id or r.accepted_by = m.id) and r.status in ('open', 'accepted', 'confirmed', 'in_progress')));
  else
    perform public.notify(c.customer_user_id, c.business_id, 'customer', 'message_new', jsonb_build_object('conversationId', c.id, 'businessName', b.bname, 'businessSlug', b.slug), hour_key);
  end if;
  return msg;
end;
$$;

create or replace function public.mark_conversation_read(p_conversation uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); c record; member uuid;
begin
  select * into c from public.chat_conversations where id = p_conversation;
  if not found then return; end if;
  if c.customer_user_id = uid then
    update public.chat_conversations set customer_last_read_at = now() where id = c.id;
  elsif public.chat_staff_access(p_conversation) then
    select m.id into member from public.my_member(c.business_id) m;
    insert into public.chat_staff_reads (conversation_id, business_id, member_id, last_read_at) values (c.id, c.business_id, member, now())
    on conflict (conversation_id, member_id) do update set last_read_at = now();
  end if;
end;
$$;

-- Block or unblock. The owner can block for themselves; on the salon side the front desk can. Only the side that blocked can unblock.
create or replace function public.set_conversation_blocked(p_conversation uuid, p_blocked boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); c record; side text;
begin
  select * into c from public.chat_conversations where id = p_conversation for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if c.customer_user_id = uid then side := 'customer';
  elsif public.has_business_role(c.business_id, array['owner', 'manager', 'receptionist']::public.business_role[]) then side := 'business';
  else raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_blocked then
    if c.blocked_by is null then update public.chat_conversations set blocked_by = side, blocked_at = now() where id = c.id; end if;
  else
    if c.blocked_by is distinct from side then raise exception 'not_allowed' using errcode = '42501'; end if;
    update public.chat_conversations set blocked_by = null, blocked_at = null where id = c.id;
  end if;
end;
$$;

create or replace function public.report_conversation(p_conversation uuid, p_reason text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); c record; side text; rid uuid;
begin
  select * into c from public.chat_conversations where id = p_conversation;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if c.customer_user_id = uid then side := 'customer';
  elsif public.chat_staff_access(p_conversation) then side := 'staff';
  else raise exception 'not_found' using errcode = 'P0002';
  end if;
  if (select count(*) from public.chat_reports where reporter_user_id = uid and created_at > now() - interval '1 day') >= 5 then
    raise exception 'rate_limited' using errcode = '22023';
  end if;
  insert into public.chat_reports (conversation_id, business_id, reporter_kind, reporter_user_id, reason)
  values (c.id, c.business_id, side, uid, nullif(btrim(left(coalesce(p_reason, ''), 500)), '')) returning id into rid;
  perform public.notify(m.user_id, c.business_id, 'staff', 'message_reported', jsonb_build_object('conversationId', c.id, 'customerName', c.customer_name), 'report:' || rid)
     from public.business_members m
    where m.business_id = c.business_id and m.status = 'active' and m.role in ('owner', 'manager') and m.user_id is distinct from uid;
  return rid;
end;
$$;

create or replace function public.resolve_chat_report(p_report uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  select * into r from public.chat_reports where id = p_report;
  if not found or not public.has_business_role(r.business_id, array['owner', 'manager']::public.business_role[]) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  update public.chat_reports set resolved_at = coalesce(resolved_at, now()) where id = p_report;
end;
$$;

revoke all on function public.start_conversation(text), public.send_chat_message(uuid, text), public.mark_conversation_read(uuid),
  public.set_conversation_blocked(uuid, boolean), public.report_conversation(uuid, text), public.resolve_chat_report(uuid) from public, anon;
grant execute on function public.start_conversation(text), public.send_chat_message(uuid, text), public.mark_conversation_read(uuid),
  public.set_conversation_blocked(uuid, boolean), public.report_conversation(uuid, text), public.resolve_chat_report(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Reads: conversation lists with unread state
-- ---------------------------------------------------------------------

-- Definer: pet owners can't read businesses directly; this returns only the caller's own conversations.
create or replace function public.my_conversations()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id, 'businessName', b.name, 'businessSlug', b.slug, 'timezone', b.timezone, 'lastMessageAt', c.last_message_at, 'blockedBy', c.blocked_by,
    'preview', (select left(m.body, 120) from public.chat_messages m where m.conversation_id = c.id order by m.created_at desc limit 1),
    'unread', exists (select 1 from public.chat_messages m where m.conversation_id = c.id and m.sender_kind = 'staff' and m.created_at > coalesce(c.customer_last_read_at, '-infinity'::timestamptz))
  ) order by coalesce(c.last_message_at, c.created_at) desc), '[]'::jsonb)
  from public.chat_conversations c join public.businesses b on b.id = c.business_id
  where c.customer_user_id = (select auth.uid());
$$;

create or replace function public.business_conversations(p_business uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  with me as (select id from public.my_member(p_business))
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id, 'customerName', c.customer_name, 'lastMessageAt', c.last_message_at, 'blockedBy', c.blocked_by,
    'preview', (select left(m.body, 120) from public.chat_messages m where m.conversation_id = c.id order by m.created_at desc limit 1),
    'unread', exists (select 1 from public.chat_messages m where m.conversation_id = c.id and m.sender_kind = 'customer'
                       and m.created_at > coalesce((select r.last_read_at from public.chat_staff_reads r where r.conversation_id = c.id and r.member_id = (select id from me)), '-infinity'::timestamptz)),
    'openReports', (select count(*) from public.chat_reports r where r.conversation_id = c.id and r.resolved_at is null)
  ) order by coalesce(c.last_message_at, c.created_at) desc), '[]'::jsonb)
  from public.chat_conversations c
  where c.business_id = p_business and c.last_message_at is not null;
$$;
revoke all on function public.my_conversations(), public.business_conversations(uuid) from public, anon;
grant execute on function public.my_conversations(), public.business_conversations(uuid) to authenticated;

-- Live updates: messages are published to Supabase Realtime (RLS still applies to subscribers).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
end;
$$;
