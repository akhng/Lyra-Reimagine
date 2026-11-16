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

-- Customer portal demo (transformation R3). LOCAL TEST DATA ONLY.
--   sarah.nguyen@example.test (password-123) — pet owner; her account links to the
--   existing customer record at Fluff & Fold, with Mochi and Biscuit as her own pet profiles.
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
values ('00000000-0000-0000-0000-000000000000', 'eeeeeeee-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'sarah.nguyen@example.test', crypt('password-123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Sarah Nguyen","intent":"owner"}', now(), now(), '', '', '', '')
on conflict (id) do nothing;
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text, jsonb_build_object('sub', u.id::text, 'email', u.email), 'email', now(), now(), now()
from auth.users u where u.email = 'sarah.nguyen@example.test' and not exists (select 1 from auth.identities i where i.user_id = u.id);

do $$
declare
  biz constant uuid := 'd0000000-0000-4000-8000-0000000000d1';
  sarah constant uuid := 'eeeeeeee-0000-4000-8000-000000000001';
  cust uuid; p record; op uuid;
begin
  if exists (select 1 from public.owner_pets where user_id = sarah) then return; end if;
  insert into public.marketplace_profiles (business_id, listed, headline, about, suburb, mascot)
  values (biz, true, 'Gentle, fear-free grooming in Fitzroy', 'A small team of groomers who take their time. Cats and dogs welcome, with quiet appointments for nervous pets.', 'Fitzroy', 'coco')
  on conflict (business_id) do nothing;
  select c.id into cust from public.customers c join public.customer_contacts cc on cc.customer_id = c.id where c.business_id = biz and cc.email = 'sarah.nguyen@example.test';
  update public.customers set account_user_id = sarah where id = cust;
  for p in select * from public.pets where customer_id = cust loop
    insert into public.owner_pets (user_id, name, species, breed, size, coat_type, grooming_preferences, care_notes, date_of_birth)
    values (sarah, p.name, p.species, p.breed, p.size, p.coat_type, case when p.species = 'cat' then 'Teddy-bear face, short tidy' else 'Brush out and tidy feathers' end, p.behaviour, case when p.species = 'cat' then date '2021-04-12' else date '2019-09-03' end)
    returning id into op;
    update public.pets set owner_pet_id = op, owner_notes = public.owner_notes_text(case when p.species = 'cat' then 'Teddy-bear face, short tidy' else 'Brush out and tidy feathers' end, p.behaviour) where id = p.id;
  end loop;
end $$;

-- Request marketplace demo (transformation R4). LOCAL TEST DATA ONLY.
-- Fluff & Fold opens requests to groomers (40% commission); Sarah has asked for Mochi tomorrow at 2 pm,
-- so alex@example.test and sam@example.test see it on their shift board.
do $$
declare
  biz constant uuid := 'd0000000-0000-4000-8000-0000000000d1';
  sarah constant uuid := 'eeeeeeee-0000-4000-8000-000000000001';
  r record; req uuid; svc record; st timestamptz;
begin
  if exists (select 1 from public.booking_requests where business_id = biz) then return; end if;
  update public.booking_policies set allocation_mode = 'open', accept_hours = 24, groomer_commission_percent = 40 where business_id = biz;
  select c.id as customer_id, p.id as pet_id, l.id as location_id into r
  from public.customers c join public.pets p on p.customer_id = c.id and p.name = 'Mochi' join public.locations l on l.business_id = c.business_id
  where c.business_id = biz and c.account_user_id = sarah limit 1;
  select * into svc from public.services where business_id = biz and name = 'Full groom';
  st := (((now() at time zone 'Australia/Melbourne')::date + 1) + time '14:00') at time zone 'Australia/Melbourne';
  insert into public.booking_requests (business_id, requester_id, customer_id, pet_id, location_id, status, preferred_start, notes, estimate_cents, estimate_minutes, block_minutes, accept_deadline)
  values (biz, sarah, r.customer_id, r.pet_id, r.location_id, 'open', st, 'Teddy-bear face again please!', svc.base_price_cents, svc.duration_minutes, svc.duration_minutes + svc.buffer_minutes, least(now() + interval '24 hours', st - interval '1 hour'))
  returning id into req;
  insert into public.booking_request_services (business_id, request_id, service_id, name, duration_minutes, price_cents) values (biz, req, svc.id, svc.name, svc.duration_minutes, svc.base_price_cents);
  insert into public.booking_request_events (business_id, request_id, actor_id, from_status, to_status) values (biz, req, sarah, null, 'submitted'), (biz, req, sarah, 'submitted', 'open');
end $$;

-- Gamification demo (transformation R5). LOCAL TEST DATA ONLY.
-- Fluff & Fold's loyalty rules and rewards; points for its past completed appointments
-- (seeded history bypassed the completion trigger), milestones, and two reviews from Sarah.
do $$
declare
  biz constant uuid := 'd0000000-0000-4000-8000-0000000000d1';
  sarah constant uuid := 'eeeeeeee-0000-4000-8000-000000000001';
  a record; p record; n int := 0;
begin
  if exists (select 1 from public.loyalty_settings where business_id = biz) then return; end if;
  insert into public.loyalty_settings (business_id, points_per_appointment, points_per_dollar, birthday_points) values (biz, 10, 1, 50);
  insert into public.loyalty_rewards (business_id, name, description, cost_points) values
    (biz, 'Free nail trim', 'Added to any groom', 150),
    (biz, 'Blueberry facial', 'A gentle face wash that smells amazing', 250),
    (biz, '$20 off a full groom', null, 400);
  for a in select * from public.appointments where business_id = biz and status = 'completed' order by starts_at loop
    perform public.award_points(biz, a.customer_id, 10 + floor(coalesce(a.price_estimate_cents, 0) / 100.0)::int, 'appointment', 'appt:' || a.id, null);
  end loop;
  for p in select id from public.pets where business_id = biz loop
    perform public.evaluate_pet_achievements(biz, p.id);
  end loop;
  perform public.evaluate_business_achievements(biz);
  for a in select ap.* from public.appointments ap join public.customers c on c.id = ap.customer_id where ap.business_id = biz and ap.status = 'completed' and c.account_user_id = sarah order by ap.starts_at desc limit 2 loop
    n := n + 1;
    insert into public.reviews (business_id, appointment_id, customer_id, author_id, rating, comment, reply, replied_at)
    values (biz, a.id, a.customer_id, sarah, case when n = 1 then 5 else 4 end, case when n = 1 then 'Mochi came home looking like a cloud. So gentle with her!' else 'Lovely job, a little late picking up.' end, case when n = 1 then 'Thank you Sarah, Mochi is a delight!' end, case when n = 1 then now() end);
  end loop;
end $$;
