-- Customer emails for important booking updates, and live notifications.
--
-- Emails are queued in the same transaction as the in-app notification (a
-- trigger on notifications), so an email can't be lost if the app crashes
-- between "declined" and "send". The app delivers queued rows through a
-- swappable email provider using the service-role client; nobody else can
-- read or write the outbox.

create type public.email_status as enum ('pending', 'sending', 'sent', 'failed', 'skipped');

create table public.email_outbox (
  id          bigint generated always as identity primary key,
  business_id uuid not null references public.businesses on delete cascade,
  user_id     uuid not null references auth.users on delete cascade,
  kind        text not null check (char_length(kind) <= 40),
  data        jsonb not null default '{}'::jsonb,
  dedupe_key  text not null check (char_length(dedupe_key) <= 200),
  status      public.email_status not null default 'pending',
  attempts    integer not null default 0,
  last_error  text check (last_error is null or char_length(last_error) <= 200),
  claimed_at  timestamptz,
  sent_at     timestamptz,
  created_at  timestamptz not null default now(),
  unique (user_id, kind, dedupe_key)
);
create index email_outbox_due_idx on public.email_outbox (created_at) where status in ('pending', 'sending');
create index email_outbox_business_idx on public.email_outbox (business_id);
alter table public.email_outbox enable row level security;
-- No policies: only the service role (delivery) touches the outbox.
revoke all on public.email_outbox from anon, authenticated;

-- Which customer notifications also go out by email. Add kinds here as their emails are written.
create or replace function public.queue_email_for_notification()
returns trigger language plpgsql security definer set search_path = '' as $$
declare req uuid; reason text; refund boolean := false;
begin
  if new.audience <> 'customer' or new.business_id is null or new.kind not in ('request_rejected') then return new; end if;
  req := nullif(new.data->>'requestId', '')::uuid;
  if req is not null then
    select r.decision_reason into reason from public.booking_requests r where r.id = req;
    -- The refund trigger has already run by the time the decline notification is written.
    refund := exists (select 1 from public.payments p where p.request_id = req and p.status in ('refund_due', 'refunded'));
  end if;
  insert into public.email_outbox (business_id, user_id, kind, data, dedupe_key)
  values (new.business_id, new.user_id, new.kind, new.data || jsonb_build_object('reason', reason, 'refund', refund), new.dedupe_key)
  on conflict (user_id, kind, dedupe_key) do nothing;
  return new;
end;
$$;
revoke all on function public.queue_email_for_notification() from public, anon, authenticated;
create trigger notifications_queue_email after insert on public.notifications for each row execute function public.queue_email_for_notification();

-- Delivery claims a batch. Rows stuck in 'sending' (a crashed delivery) are retried after
-- 10 minutes; anything older than a day is skipped rather than sent late (for example,
-- when an email provider is configured after rows have been waiting).
create or replace function public.claim_email_outbox(p_limit integer)
returns setof public.email_outbox language plpgsql security definer set search_path = '' as $$
begin
  update public.email_outbox set status = 'skipped', last_error = 'too old to send'
  where status in ('pending', 'sending') and created_at < now() - interval '24 hours';
  return query
  update public.email_outbox o set status = 'sending', claimed_at = now(), attempts = o.attempts + 1
  where o.id in (
    select e.id from public.email_outbox e
    where (e.status = 'pending' or (e.status = 'sending' and e.claimed_at < now() - interval '10 minutes')) and e.attempts < 5
    order by e.created_at
    limit greatest(1, least(p_limit, 50))
    for update skip locked)
  returning o.*;
end;
$$;
revoke all on function public.claim_email_outbox(integer) from public, anon, authenticated;
grant execute on function public.claim_email_outbox(integer) to service_role;

-- Live updates: customers' notifications are published to Supabase Realtime
-- (RLS still applies, so subscribers only receive their own rows).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;
