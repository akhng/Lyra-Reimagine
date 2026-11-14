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
