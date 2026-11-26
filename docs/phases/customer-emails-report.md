# Report: declined-request email and live notices (ADR 0006)

## What was built

- **Email when a salon declines a request.** Subject "*Salon* couldn't take *Pet*'s grooming request". The email names the services and time, includes the salon's reason if it gave one, says "refunded in full" if the customer had paid, and links to the request.
- **Live notices for the pet owner.** While they have the portal open, a declined request appears at the top of the home page (`/me`) and the bell count goes up, without a reload. The notice stays until they open the request or dismiss it.
- **Fix to existing behaviour:** the request page ran the salon's reason into the next sentence ("…Fully booked that week You can…"). It now ends with a full stop.
- **Test fix:** `scheduling.test.ts` "simultaneous bookings" failed whenever it ran on a Thursday (Melbourne time). Day 3 fell on a Sunday, which the test helper moves onto day 4, so the slot was already taken. The test now uses a time clear of the earlier bookings.

## Files

- Migration `20261126000000_email_outbox.sql`: `email_outbox` (RLS, service role only), the `queue_email_for_notification` trigger, `claim_email_outbox`, and `notifications` added to `supabase_realtime`.
- `features/email/`: `provider.ts`, `resend.ts` (+ tests), `fake.ts`, `templates.ts` (+ tests), `service.ts`.
- `components/notifications/LiveNotifications.tsx` and `DeclinedNotices.tsx`; `app/me/layout.tsx`, `app/me/page.tsx`, `app/me/requests/[id]/page.tsx`.
- Delivery hooks: `features/requests/actions.ts` (after a decline), `features/requests/queries.ts` and `features/portal/queries.ts` (retries on page load).
- `packages/platform/src/env.ts`: `EMAIL_PROVIDER`, `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_FAKE_URL`.

## Decisions

See ADR 0006: outbox written in the decline's transaction; provider chosen later; emails over a day old skipped; live updates through Realtime as for messages.

## Tests

- `pnpm check`: lint, typecheck, 52 unit tests (4 new for the email wording, including HTML escaping) and build pass.
- `pnpm db:test`: 82 pass. New `email-outbox.test.ts`: one email per decline with the reason; none on confirm; invisible to customers, staff and anonymous visitors; claimed once; old rows skipped. `payments.test.ts` checks the email notes the refund.
- `pnpm test:e2e`: 54 pass. New `declined.spec.ts` at 1440, 820 and 390 px with axe: the pet owner's open home page shows the notice live and the bell counts it, the email arrives in Mailpit with the reason and link, and opening the request clears the notice.
- The live test was checked to fail with the Realtime refresh switched off.

## Not verified here / gaps

- **Resend is untested against the real service** (no key or network access here). The unit tests check the request it sends (address, headers, body) with a fake network call. Do one real decline after setup and check Resend → Emails.
- **Realtime in production:** check Supabase → Database → Publications shows `notifications` in `supabase_realtime` after running the migration.
- Delivery has no scheduled job; it runs on decline and on page loads.

## Setup required (product owner)

1. Run the migration `20261126000000_email_outbox.sql` in the Supabase SQL Editor.
2. In Resend, verify your sending domain (Domains → Add domain, then add the DNS records it shows).
3. In Vercel (Production), add `EMAIL_PROVIDER=resend`, `RESEND_API_KEY` (the `re_…` key) and `EMAIL_FROM` (e.g. `Lyra Pet <bookings@your-domain>`, on the verified domain), then redeploy.

## Next phase assumes

Customer emails go through `email_outbox` and `EmailProvider` only. New email kinds add a template and the kind to `queue_email_for_notification()`.
