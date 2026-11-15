-- Local development and tests only. Never run against a cloud project.
-- Test accounts (password: password-123) and two separate businesses, so
-- cross-tenant isolation can be checked by hand.
--   olivia@example.test — owner of "Paws Test Salon" (paws-test)
--   ned@example.test    — owner of "Neat Coat Test Grooming" (neat-coat-test)
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'olivia@example.test', crypt('password-123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Olivia Test"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'ned@example.test', crypt('password-123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Ned Test"}', now(), now(), '', '', '', '');

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text, jsonb_build_object('sub', u.id::text, 'email', u.email), 'email', now(), now(), now() from auth.users u where u.email in ('olivia@example.test', 'ned@example.test');

insert into public.businesses (id, name, slug, timezone, created_by) values
  ('a0000000-0000-4000-8000-000000000001', 'Paws Test Salon', 'paws-test', 'Australia/Melbourne', 'aaaaaaaa-0000-4000-8000-000000000001'),
  ('b0000000-0000-4000-8000-000000000002', 'Neat Coat Test Grooming', 'neat-coat-test', 'Australia/Sydney', 'bbbbbbbb-0000-4000-8000-000000000002');
insert into public.business_members (business_id, user_id, role, display_name) values
  ('a0000000-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'owner', 'Olivia Test'),
  ('b0000000-0000-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-000000000002', 'owner', 'Ned Test');
insert into public.locations (business_id, name, timezone) values
  ('a0000000-0000-4000-8000-000000000001', 'Main location', 'Australia/Melbourne'),
  ('b0000000-0000-4000-8000-000000000002', 'Main location', 'Australia/Sydney');

-- Phase 3 (scheduling): opening hours, staff hours and online booking for the test salon. LOCAL TEST DATA ONLY.
insert into public.booking_policies (business_id, online_enabled, min_notice_minutes, max_days_ahead, slot_step_minutes, cancellation_hours, policy_text)
values ('a0000000-0000-4000-8000-000000000001', true, 60, 60, 15, 24, 'Please arrive 5 minutes early. Cancel at least 24 hours ahead.')
on conflict (business_id) do nothing;
insert into public.location_hours (business_id, location_id, weekday, opens, closes)
select l.business_id, l.id, d, '08:00', '17:00' from public.locations l, generate_series(1, 6) d
where l.business_id = 'a0000000-0000-4000-8000-000000000001' and not l.is_mobile
on conflict do nothing;
insert into public.staff_hours (business_id, member_id, location_id, weekday, starts, ends)
select m.business_id, m.id, l.id, d, '08:00', '17:00'
from public.business_members m join public.locations l on l.business_id = m.business_id and not l.is_mobile, generate_series(1, 6) d
where m.business_id = 'a0000000-0000-4000-8000-000000000001'
on conflict do nothing;

-- =====================================================================
-- Demo salon (transformation R2): realistic local demo data for the new
-- dashboard. LOCAL TEST DATA ONLY — fictional people and pets.
--   demo@example.test  — owner of "Fluff & Fold Grooming" (fluff-and-fold)
--   alex@example.test, sam@example.test — groomers there
-- Appointment times are relative to the day the seed runs.
-- =====================================================================
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
values
  ('00000000-0000-0000-0000-000000000000', 'dddddddd-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'demo@example.test', crypt('password-123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Dana Demo"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'dddddddd-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'alex@example.test', crypt('password-123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Alex Groomer"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'dddddddd-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'sam@example.test', crypt('password-123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Sam Groomer"}', now(), now(), '', '', '', '')
on conflict (id) do nothing;
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text, jsonb_build_object('sub', u.id::text, 'email', u.email), 'email', now(), now(), now()
from auth.users u where u.email in ('demo@example.test', 'alex@example.test', 'sam@example.test')
  and not exists (select 1 from auth.identities i where i.user_id = u.id);

do $$
declare
  biz constant uuid := 'd0000000-0000-4000-8000-0000000000d1';
  tz constant text := 'Australia/Melbourne';
  today date := (now() at time zone 'Australia/Melbourne')::date;
  loc uuid;
  m_dana uuid; m_alex uuid; m_sam uuid;
  s_full uuid; s_bath uuid; s_nail uuid; s_ear uuid; s_shed uuid;
  owners jsonb := '[
    {"first":"Sarah","last":"Nguyen","email":"sarah.nguyen@example.test","mobile":"0412 000 101","suburb":"Fitzroy","vip":true,"pets":[{"name":"Mochi","species":"cat","breed":"Persian","size":"small","coat":"Long, white","temperament":"Gentle; dislikes the dryer on high"},{"name":"Biscuit","species":"dog","breed":"Golden Retriever","size":"large","coat":"Double coat, golden","temperament":"Bouncy and friendly"}]},
    {"first":"James","last":"O''Brien","email":"james.obrien@example.test","mobile":"0412 000 102","suburb":"Richmond","vip":false,"pets":[{"name":"Coco","species":"dog","breed":"Pembroke Welsh Corgi","size":"medium","coat":"Double coat, red and white","temperament":"Cheerful; wriggles during nails"}]},
    {"first":"Priya","last":"Sharma","email":"priya.sharma@example.test","mobile":"0412 000 103","suburb":"Brunswick","vip":false,"pets":[{"name":"Luna","species":"cat","breed":"British Shorthair","size":"small","coat":"Short, blue-grey","temperament":"Calm and elegant"}]},
    {"first":"Tom","last":"Rossi","email":"tom.rossi@example.test","mobile":"0412 000 104","suburb":"Carlton","vip":false,"pets":[{"name":"Max","species":"dog","breed":"Labradoodle","size":"medium","coat":"Curly, apricot","temperament":"Loves treats"}]},
    {"first":"Emily","last":"Chen","email":"emily.chen@example.test","mobile":"0412 000 105","suburb":"South Yarra","vip":true,"pets":[{"name":"Peanut","species":"dog","breed":"Cavoodle","size":"small","coat":"Wavy, caramel","temperament":"Shy at first"},{"name":"Bella","species":"dog","breed":"Maltese","size":"small","coat":"Long, white","temperament":"Sits beautifully"}]},
    {"first":"Liam","last":"Walker","email":"liam.walker@example.test","mobile":"0412 000 106","suburb":"Northcote","vip":false,"pets":[{"name":"Rocky","species":"dog","breed":"Border Collie","size":"medium","coat":"Double coat, black and white","temperament":"Clever; needs a slow intro"}]}
  ]';
  o jsonb; pt jsonb; cust uuid; pet uuid;
  pets uuid[] := '{}'; custs uuid[] := '{}';
  appt uuid; starts timestamptz; i int; k int;
  st public.appointment_status;
  svc record;
begin
  if exists (select 1 from public.businesses where id = biz) then return; end if;
  insert into public.businesses (id, name, slug, timezone, created_by, phone) values (biz, 'Fluff & Fold Grooming', 'fluff-and-fold', tz, 'dddddddd-0000-4000-8000-000000000001', '03 9000 1234');
  insert into public.business_members (business_id, user_id, role, display_name) values (biz, 'dddddddd-0000-4000-8000-000000000001', 'owner', 'Dana') returning id into m_dana;
  insert into public.business_members (business_id, user_id, role, display_name) values (biz, 'dddddddd-0000-4000-8000-000000000002', 'groomer', 'Alex') returning id into m_alex;
  insert into public.business_members (business_id, user_id, role, display_name) values (biz, 'dddddddd-0000-4000-8000-000000000003', 'groomer', 'Sam') returning id into m_sam;
  insert into public.locations (business_id, name, timezone, address_line, suburb) values (biz, 'Fitzroy studio', tz, '12 Brunswick St', 'Fitzroy') returning id into loc;
  insert into public.location_hours (business_id, location_id, weekday, opens, closes) select biz, loc, d, '08:00', '18:00' from generate_series(1, 7) d;
  insert into public.staff_hours (business_id, member_id, location_id, weekday, starts, ends) select biz, m, loc, d, '08:00', '18:00' from unnest(array[m_dana, m_alex, m_sam]) m, generate_series(1, 7) d;
  insert into public.booking_policies (business_id, online_enabled, min_notice_minutes, max_days_ahead, slot_step_minutes, cancellation_hours, policy_text)
  values (biz, true, 120, 60, 30, 24, 'Please arrive five minutes early. Free cancellation up to 24 hours before.');

  insert into public.services (business_id, name, category, duration_minutes, buffer_minutes, base_price_cents, position) values (biz, 'Full groom', 'Grooming', 90, 15, 9500, 1) returning id into s_full;
  insert into public.services (business_id, name, category, duration_minutes, buffer_minutes, base_price_cents, position) values (biz, 'Bath and blow dry', 'Grooming', 60, 10, 6500, 2) returning id into s_bath;
  insert into public.services (business_id, name, category, duration_minutes, buffer_minutes, base_price_cents, position) values (biz, 'Nail clipping', 'Care', 20, 5, 2500, 3) returning id into s_nail;
  insert into public.services (business_id, name, category, duration_minutes, buffer_minutes, base_price_cents, position) values (biz, 'Ear cleaning', 'Care', 15, 5, 2000, 4) returning id into s_ear;
  insert into public.services (business_id, name, category, duration_minutes, buffer_minutes, base_price_cents, position) values (biz, 'De-shedding treatment', 'Grooming', 75, 15, 8500, 5) returning id into s_shed;

  for o in select * from jsonb_array_elements(owners) loop
    insert into public.customers (business_id, first_name, last_name, is_vip, created_at) values (biz, o->>'first', o->>'last', (o->>'vip')::boolean, now() - interval '40 days') returning id into cust;
    insert into public.customer_contacts (customer_id, business_id, email, mobile, suburb, state, postcode) values (cust, biz, o->>'email', o->>'mobile', o->>'suburb', 'VIC', '3065');
    for pt in select * from jsonb_array_elements(o->'pets') loop
      insert into public.pets (business_id, customer_id, name, species, breed, size, coat_type, behaviour, groom_interval_weeks)
      values (biz, cust, pt->>'name', (pt->>'species')::public.pet_species, pt->>'breed', (pt->>'size')::public.pet_size, pt->>'coat', pt->>'temperament', 6) returning id into pet;
      pets := pets || pet; custs := custs || cust;
    end loop;
  end loop;

  -- Fourteen days of completed history (two appointments a day), then today and two online bookings to confirm.
  for i in 1..14 loop
    for k in 0..1 loop
      pet := pets[1 + ((i * 2 + k) % array_length(pets, 1))];
      cust := custs[1 + ((i * 2 + k) % array_length(custs, 1))];
      select * into svc from public.services where id = (array[s_full, s_bath, s_shed, s_full])[1 + ((i + k) % 4)];
      starts := ((today - i) + (case when k = 0 then time '10:00' else time '13:00' end)) at time zone tz;
      insert into public.appointments (business_id, location_id, customer_id, pet_id, groomer_id, starts_at, service_ends_at, ends_at, status, source, price_estimate_cents)
      values (biz, loc, cust, pet, case when k = 0 then m_alex else m_sam end, starts, starts + make_interval(mins => svc.duration_minutes), starts + make_interval(mins => svc.duration_minutes + svc.buffer_minutes), 'completed', case when i % 3 = 0 then 'online' else 'staff' end, svc.base_price_cents)
      returning id into appt;
      insert into public.appointment_services (business_id, appointment_id, service_id, name, duration_minutes, price_cents) values (biz, appt, svc.id, svc.name, svc.duration_minutes, svc.base_price_cents);
    end loop;
  end loop;

  for i in 1..5 loop
    pet := pets[i]; cust := custs[i];
    select * into svc from public.services where id = (array[s_full, s_bath, s_full, s_nail, s_bath])[i];
    starts := (today + (array[time '09:00', time '11:00', time '09:30', time '13:00', time '14:30'])[i]) at time zone tz;
    st := case when starts + make_interval(mins => svc.duration_minutes) < now() then 'completed' when starts < now() then 'in_progress' else 'confirmed' end;
    insert into public.appointments (business_id, location_id, customer_id, pet_id, groomer_id, starts_at, service_ends_at, ends_at, status, source, price_estimate_cents)
    values (biz, loc, cust, pet, (array[m_alex, m_alex, m_sam, m_sam, m_dana])[i], starts, starts + make_interval(mins => svc.duration_minutes), starts + make_interval(mins => svc.duration_minutes + svc.buffer_minutes), st, 'staff', svc.base_price_cents)
    returning id into appt;
    insert into public.appointment_services (business_id, appointment_id, service_id, name, duration_minutes, price_cents) values (biz, appt, svc.id, svc.name, svc.duration_minutes, svc.base_price_cents);
  end loop;

  for i in 6..7 loop
    pet := pets[i]; cust := custs[i];
    select * into svc from public.services where id = s_bath;
    starts := ((today + (i - 5)) + time '10:00') at time zone tz;
    insert into public.appointments (business_id, location_id, customer_id, pet_id, groomer_id, starts_at, service_ends_at, ends_at, status, source, price_estimate_cents, customer_notes)
    values (biz, loc, cust, pet, case when i = 6 then m_alex else m_sam end, starts, starts + make_interval(mins => svc.duration_minutes), starts + make_interval(mins => svc.duration_minutes + svc.buffer_minutes), 'booked', 'online', svc.base_price_cents, 'First visit, a little nervous with dryers.')
    returning id into appt;
    insert into public.appointment_services (business_id, appointment_id, service_id, name, duration_minutes, price_cents) values (biz, appt, svc.id, svc.name, svc.duration_minutes, svc.base_price_cents);
  end loop;
end $$;
