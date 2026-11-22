# Lyra Reimagine — architecture

## Products and platform

```
Lyra Reimagine (this repo)
├─ apps/pet            Lyra Pet — pet grooming business SaaS (first product)
├─ apps/salon …        future products, each an independent app
├─ packages/platform   shared services: env, auth/session, tenancy, Supabase clients, logging, errors
└─ packages/ui         shared design-system primitives
Lyra Life OS           separate repository and database (ADR 0001)
```

Each product has its own Supabase project (Lyra Pet: Sydney region in production) and its own Vercel project. Shared code is reused through workspace packages, not shared databases.

## Tenancy

- A **business** is the tenant. People sign in with Supabase Auth and belong to businesses through **business_members** (role: owner, manager, receptionist, groomer; status: active, invited, suspended).
- Every business-owned row has `business_id`; Row Level Security permits access only to active members, by role:
  - `is_business_member(business_id)` — any active member;
  - `has_business_role(business_id, roles[])` — specific roles.
- **Locations** belong to a business (salons, shopfronts or a mobile van). Later tables (customers, pets, appointments, staff rosters, payments) carry both `business_id` and, where relevant, `location_id` with composite foreign keys so references can't cross tenants.
- **Business creation** happens only through `create_business()` (security definer): business, owner membership, first location and an audit entry in one transaction. Plan and status are platform-controlled (column-level grants).
- **Audit log** records privileged and settings actions per business, never customer details.
- In the app, every page under `/b/<slug>` resolves the tenant with `requireBusiness(slug)`: RLS returns nothing for non-members, so another tenant's URL is a 404.

## Core grooming data (Phase 2)

- **customers** (name, preferred contact and groomer, notes, VIP, marketing consent with the date it was given) and **customer_contacts** (email, mobile, address) are separate tables so groomers can work with names and pets without seeing contact details: contacts are readable only by owners, managers and reception.
- **pets** carry grooming preferences and care information (allergies, medical notes, handling precautions). All staff can read and update them; nobody can delete customers, contacts, pets or grooming records from the app (history is kept).
- **services** and **service_price_rules** (size, breed, coat condition). Price resolution lives in `apps/pet/src/features/services/pricing.ts`: breed beats size beats base price; coat-condition surcharges add on top. Prices are in cents, GST-inclusive AUD.
- **grooming_records** (date, groomer, services and a snapshot of their names, notes, feedback) and **grooming_photos** (before/after).
- **customer_directory(business, query)** (security invoker) powers the customer list: pets, groom count, last groom and next due date in one call; search covers name, pet name, email and mobile digits, and contact matches respect RLS.

### Photos

Photos live in the private Storage bucket `media` (8 MB, JPEG/PNG/WebP). Paths start with the business id: `<business>/grooming/<record>/<uuid>.<ext>` and `<business>/pets/<pet>/<uuid>.<ext>`. Storage policies use `media_business(path)` so only members can read or upload, and only owners and managers delete. The browser uploads directly (avoiding the server request-size limit), then a server action validates each path against the business and record before saving the photo rows. Pages show photos with one-hour signed URLs.

## Scheduling and online booking (Phase 3)

- **Hours:** `location_hours` (opening hours, split shifts allowed), `staff_hours`, `staff_time_off` and `business_closures`. Times are local wall-clock times with ISO weekdays (1 = Monday); conversion to UTC happens only in `apps/pet/src/features/scheduling/time.ts` (Intl-based, tested across daylight-saving changes).
- **Appointments** store the start, the service end and the block end (service plus clean-up buffer), with `appointment_services` keeping a snapshot of each service's name, duration and price. **No double-booking is enforced by an exclusion constraint** (`btree_gist`) on (groomer, block) for every appointment that isn't cancelled or a no-show, so two simultaneous bookings can't both succeed. Recurring bookings are `appointment_series` plus ordinary appointments; clashing repeats are skipped and listed.
- **Permissions:** all staff read the calendar; owners, managers and reception create and change appointments; owners and managers set hours and the booking policy. Groomers change the status of their own appointments only, through `set_appointment_status()`. Nothing is deleted (cancellations are recorded).
- **Availability** (`features/scheduling/availability.ts`) is a pure function: opening ∩ staff hours, minus time off, closures and busy blocks, then notice, horizon and slot step. It is for display; the database re-checks every booking.
- **Public booking** (`/book/<slug>`, no customer accounts): anonymous visitors never read tables. Security-definer functions expose only what booking needs: `booking_context` (no customer data), `create_online_booking` (re-checks policy, hours, notice and overlap; finds or creates the customer and pet; rate limited per business, email and client via `booking_attempts`), and `get/cancel/reschedule_booking_by_token`. The customer gets a private manage link; only the SHA-256 hash of its token is stored, and staff can't read the hash. A honeypot field and a minimum fill time block simple bots. Confirmation is the manage page plus an `.ics` file until email/SMS arrive in Phase 4.

## Business dashboard (transformation R2, ADR 0003)

- A greeting from the day's mascot with a message from real counts, then a personal **board** of tiles: today's appointments, booking requests (online bookings awaiting confirmation until the R4 request queue), available groomers (staff hours and time off now), customers and pets, services (most booked in 30 days), revenue (rolling 7 days of completed appointment estimates, labelled as estimates) and achievements (progress from real records; awards arrive with R5). Customer reviews and loyalty tiles arrive with R5, when that data exists.
- Tiles depend on role (`allowedTiles`): money for owners and managers, booking requests for the front desk.
- `@dnd-kit` handles dragging (pointer, short-press touch, keyboard on the handle); Customise mode adds pin, widen, hide/show and move earlier/later buttons. Every tile is also a link. Layouts are saved per person and business in `dashboard_layouts` (RLS: own row, member only, 4 KB cap) and normalised by pure functions in `features/dashboard/layout.ts`.

## Customer portal and booking requests (transformation R3, ADR 0003)

- **People, not just staff.** One Supabase Auth account can be staff, a pet owner, or both. Sign-up asks which; `/home` sends people without a business to the pet owner portal `/me` (or to onboarding if they signed up to run one).
- **Shared customers and pets.** `customers.account_user_id` links a business's customer record to a person. `claim_customer_records()` links records whose contact email matches the person's **verified** email, so existing customers never register twice. Pet owners keep their own `owner_pets` (photo in the private `owner-media` bucket); each business pet links to one (`pets.owner_pet_id`), owner edits flow to linked pets by trigger, and the owner's grooming preferences and care notes appear to staff read-only (`pets.owner_notes`). Staff can't change the link or the notes (column grants).
- **Marketplace.** Businesses opt in with `marketplace_profiles` (listed, accepting requests, headline, about, suburb, mascot). `marketplace_listings()` / `marketplace_listing(slug)` expose listed salons, online-bookable services, size prices, hours and policy — no customer data. Favourites by slug via `toggle_favourite_business` / `my_favourite_slugs`.
- **Booking requests.** `submit_booking_request()` (verified email, listed and accepting salon, the caller's own pet, bookable services, a preferred time or up to three flexible days, fair-use limits) finds or creates the customer and linked pet and stores the request with a size-priced estimate. Status history in `booking_request_events`. `review_booking_request()` (front desk) confirms with a groomer and time — checked against hours and the existing no-overlap constraint inside the same transaction, so nothing is confirmed before availability is validated — or rejects with a reason. `cancel_booking_request()` (requester; after confirmation only outside the cancellation window, cancelling the appointment too). Appointment progress mirrors onto the request (grooming, completed, cancelled). Customers read their own requests and appointments through `my_bookings()`.
- **Screens.** Portal: home (welcome, illustrated pet cards, tiles), pets with photos, salons, the booking journey (pet → salon → services → time → notes → review → submit, with a celebration), bookings and request tracking. Staff: Requests queue with confirm/decline, Settings → Lyra Pet listing, owner notes on the pet page, the dashboard's Booking requests tile.

## Request marketplace and notifications (transformation R4, ADR 0003)

- **Allocation per business** (`booking_policies.allocation_mode`, set in Settings → Request allocation): *manual* (front desk reviews), *open* (straight to eligible groomers' shift board), *automatic* (books the first capable, available groomer at an allowed time, else the shift board) and *assigned only* (the front desk assigns one groomer, who accepts). `accept_hours` sets the acceptance deadline (never later than an hour before the requested time); an optional groomer commission is shown as an estimate.
- **Eligibility:** active owners, managers and groomers; `member_services` limits a groomer to some services (none listed = all); the assigned groomer only, if assigned; and the time must fit their working hours.
- **One winner:** `accept_booking_request()` locks the request row, re-checks status, deadline, assignment, capability, the offered times and working hours, then inserts the appointment under the existing no-overlap constraint, all in one transaction. A second groomer gets `no_longer_available`. Front desk tools: `open_booking_request` (any eligible groomer, or one), `close_booking_request` (take it back), `review_booking_request` (confirm/decline).
- **Shift board** (`shift_board()`): open requests the groomer may take, with pet photo, breed, size, services, duration, requested time or the offered times that fit their hours, commission estimate, deadline and instructions — no contact details. Groomers can set their own hours (`save_my_hours`) when the business allows.
- **Housekeeping without a scheduler:** `tidy_booking_requests()` returns unclaimed requests to the front desk at their deadline and expires requests whose time has passed; `queue_my_reminders()` adds reminders for the next 24 hours. Both are idempotent and run when the requests page, shift board, dashboard or customer portal loads.
- **Notifications:** one `notifications` table per person (audience customer or staff, kind, small payload, dedupe key, read flag; RLS own rows; only `read_at` is writable). Database functions create them for new, open, assigned, accepted, confirmed, rejected, cancelled, unclaimed and expired requests, grooming started and completed, and reminders. Wording lives in `features/notifications/templates.ts`, so email or SMS delivery can be added later as channels without changing callers (no provider is configured; nothing is sent outside the app).

## Gamification, loyalty and reviews (transformation R5, ADR 0003)

- **Engine in the database:** `points_ledger` (earned, redeemed, reversed; `source_key` unique per business and customer, so the same event can never pay twice), `achievement_awards` (unique per business+key or pet+key), `loyalty_settings` (points per completed appointment and per dollar, pet birthday points, loyalty and achievements switches) and `loyalty_rewards`. A trigger on appointment completion awards points and evaluates pet milestones (1st, 5th, 10th, 25th groom) and business achievements (the catalogue in `features/dashboard/achievements.ts`, plus Five-Star Champion), with notifications. If a completed appointment changes status, its points are reversed. Points are never awarded for submitting a request, and gamification never touches prices, availability or payments.
- **Redemption** (`redeem_reward`, front desk) locks the customer and checks the balance. **Birthdays** (`claim_birthday_rewards`) pay once a year when the owner opens the app within 30 days after the birthday.
- **Levels and streaks** are computed from the ledger and completed grooms by pure functions (`features/loyalty/engine.ts`): levels from lifetime points (redemptions never lower a level); streaks count grooms within the pet's interval plus two weeks and never punish a gap.
- **Reviews:** one per completed appointment by its customer (`submit_review`), owner/manager replies (`reply_review`), staff read via RLS.
- **Screens:** pet owners get Rewards (balance, level, progress, rewards, history, badges), streak and badge chips on pet cards, a celebration and review form on completed requests. Staff get Settings → Loyalty & rewards, a points panel with Redeem on the customer page, Reviews with replies, dashboard tiles for reviews and loyalty, achievements with unlock dates, and a colour-coded calendar month view.

## Payments (ADR 0004)

Salons connect their own Stripe account (Connect, direct charges). When a listed salon takes online payments, a customer's request is a `draft` until Stripe Checkout succeeds; then it's routed as usual. Lyra Pet's service fee is 5% (GST included), taken as Stripe's application fee; the salon pays Stripe's processing fees. Declined, expired and cancelled paid requests are refunded in full, with the fee returned.

- `features/payments/`
  - `provider.ts`: the interface.
  - `stripe.ts`: the only file that talks to Stripe.
  - `fake.ts`: test only.
  - `service.ts`: checkout, confirmation, refunds, account sync.
  - `fees.ts`: pure fee and GST maths.
  - `queries.ts`, `actions.ts`.
- `app/api/stripe/webhook`: signature-verified; handles `checkout.session.completed` / `expired`, async payment events and `account.updated`.
- Tables:
  - `payment_accounts`: owners and managers can read it; only the service role writes.
  - `payments`: the front desk and the requester can read; no client writes.
  - At most one pending or paid payment per request.
- State changes only through definer functions. The service role runs them after Stripe confirms; the requester runs `record_checkout`, which sets the amount and fee from the request.
- Settings → Payments: connect, fee explanation, monthly statement, and a tax invoice for the fees (`PLATFORM_LEGAL_NAME`, `PLATFORM_ABN`).

## Private messages (ADR 0005)

Pet owners message a salon from its listing, with or without a booking.

**Tables** (all with RLS; writes only through definer functions):
- `chat_conversations`: one per owner and salon.
- `chat_messages`.
- `chat_staff_reads`.
- `chat_reports`.

**Access:**
- The owner.
- The front desk.
- A groomer while they have a current booking for that owner.
- Owners and managers can read everything (`chat_staff_access`, `chat_can_read`).

**Functions:**
- `send_chat_message`: masks phone numbers, emails and links until the owner has paid through the app (`chat_contact_unlocked`, `mask_contact_details`). It also enforces blocks and fair use, and notifies the other side at most hourly.
- Lists: `my_conversations` / `business_conversations`, which include the unread state.

**Live updates:** Supabase Realtime on `chat_messages`, with a 30-second refresh fallback.

**UI:**
- `/me/messages`.
- `/b/[slug]/messages`, with this owner's requests in a side panel and no contact details.
- Message buttons and unread badges in both navigations.

## Request flow

`UI (Server Components / Server Actions) → feature actions (Zod validation, permission check) → user-scoped Supabase client (RLS) → Postgres`. Elevated operations use security-definer functions that check `auth.uid()` themselves.

## Security

- Session cookies via `@supabase/ssr`; `apps/pet/src/proxy.ts` refreshes sessions, sets a CSP nonce and redirects anonymous users from protected routes.
- Only the Supabase URL and anon key reach the browser.
- Email verification required to sign in.

## Roadmap (phases)

| Phase | Scope |
|---|---|
| 1 | Foundation: monorepo, tenancy, auth, business registration, settings ✓ |
| 2 | Core grooming: dashboard, customers, pets, grooming history (before/after photos), services and pricing ✓ |
| 3 | Scheduling: calendars, booking engine with database-level overlap prevention, public booking portal, recurring bookings, cancellations, waitlist ✓ |
| 4 | Operations: staff and rosters, invitations, payments (Stripe Connect), email/SMS delivery of the in-app notifications |
| 5 | AI and growth: grooming assistant, retention, loyalty, marketing, business intelligence |
| 6 | SaaS commercialisation: plans and entitlements, Stripe Billing, platform administration, usage |
| 7 | Production readiness: security review, performance, deployment |

## Performance notes

- **Region:** Supabase (Lyra Pet) is in Sydney, so Vercel functions must run in `syd1`. Each page makes several sequential database calls; from the default US region every one adds ~200 ms.
- **Auth checks use `getClaims()`**, not `getUser()`, in `proxy.ts` and `getSessionUser()`. With the project's asymmetric JWT signing keys it verifies the session locally (no Auth round trip); with a legacy symmetric secret it falls back to the Auth server. Turn on asymmetric signing keys in the Supabase dashboard (Auth → Signing Keys) to get the benefit.
- **Dynamic rendering is deliberate:** the nonce-based CSP needs a fresh nonce per response, so no page is statically cached. Keep per-request data calls few and parallel, and wrap shared queries in React `cache()` so a layout, page and `generateMetadata` share one call.
- **Loading states:** busy business pages have their own `loading.tsx` (`PageSkeleton`) so navigation shows the page title immediately.
