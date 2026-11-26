-- Email the customer when their request is accepted (front desk confirm, a groomer
-- accepting from the shift board, or automatic allocation: all three write the
-- 'request_confirmed' notification). Adds what the confirmation needs: where to go,
-- the salon's phone, the price, whether it's paid, and the cancellation window.
-- Only the salon's own details are copied; nothing about other customers.

create or replace function public.queue_email_for_notification()
returns trigger language plpgsql security definer set search_path = '' as $$
declare req uuid; extra jsonb := '{}'::jsonb; reason text; refund boolean := false;
begin
  if new.audience <> 'customer' or new.business_id is null or new.kind not in ('request_rejected', 'request_confirmed') then return new; end if;
  req := nullif(new.data->>'requestId', '')::uuid;
  if req is not null and new.kind = 'request_rejected' then
    select r.decision_reason into reason from public.booking_requests r where r.id = req;
    -- The refund trigger has already run by the time the decline notification is written.
    refund := exists (select 1 from public.payments p where p.request_id = req and p.status in ('refund_due', 'refunded'));
    extra := jsonb_build_object('reason', reason, 'refund', refund);
  elsif req is not null and new.kind = 'request_confirmed' then
    select jsonb_build_object(
      'locationName', l.name,
      'address', nullif(concat_ws(', ', l.address_line, nullif(concat_ws(' ', l.suburb, l.state, l.postcode), '')), ''),
      'phone', coalesce(l.phone, b.phone),
      'estimateCents', r.estimate_cents,
      'estimateFrom', r.estimate_from,
      'paid', exists (select 1 from public.payments p where p.request_id = r.id and p.status = 'paid'),
      'cancellationHours', coalesce((select bp.cancellation_hours from public.booking_policies bp where bp.business_id = r.business_id), 0))
    into extra
    from public.booking_requests r
    join public.businesses b on b.id = r.business_id
    left join public.locations l on l.id = r.location_id
    where r.id = req;
  end if;
  insert into public.email_outbox (business_id, user_id, kind, data, dedupe_key)
  values (new.business_id, new.user_id, new.kind, new.data || coalesce(extra, '{}'::jsonb), new.dedupe_key)
  on conflict (user_id, kind, dedupe_key) do nothing;
  return new;
end;
$$;
revoke all on function public.queue_email_for_notification() from public, anon, authenticated;
