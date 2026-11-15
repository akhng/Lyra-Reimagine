# Lyra Pet — transformation plan: gamified pet care SaaS and grooming marketplace

Source: the owner's master brief ("Transform the existing pet management website…"). This plan records the review of what exists, what is kept, redesigned or built, the data model, and the order of delivery. Decisions are in ADR 0003.

## 1. Review of the existing application (Phases 1–3 shipped)

| Area | State | Decision |
|---|---|---|
| Stack: pnpm monorepo, Next.js 16 / React 19, Tailwind 4, Supabase (Auth, Postgres, RLS, Storage), Zod, Vitest, Playwright, Vercel | Working | **Keep.** No second app; one more dependency (`@dnd-kit`, approved in the brief). |
| Tenancy: businesses, members (owner/manager/receptionist/groomer), `requireBusiness`, `can()`, RLS helpers, audit log | Working, tested | **Keep.** Customers become a new kind of user beside staff. |
| Customers, contacts (hidden from groomers), pets (care info), services, size/breed/coat pricing, grooming records, before/after photos | Working | **Keep data, redesign screens** (pet photo first, visual cards). |
| Scheduling: hours, time off, closures, booking policy, appointments with a database no-overlap constraint, recurring series, waitlist, availability engine, calendar day/week with drag | Working | **Keep engine and constraint.** Add month view, status colours, pet thumbnails. Appointment requests become the new front door. |
| Public booking `/book/<slug>` with a private manage link (no customer accounts) | Working | **Keep** for guests; signed-in customers get the portal and requests. |
| Visual identity: navy/teal, Plus Jakarta Sans, generic admin feel | Replaced | **Redesign** (ADR 0003): pastel palette, original mascots, playful but professional. |
| Notifications, customer accounts, reviews, loyalty, gamification, staff capabilities | Missing | **Build.** |
| Payments (Stripe), email/SMS | Not started (were Phase 4) | Interfaces only where the brief needs them; no fake success. Email/SMS stay "not configured" until credentials exist. |

## 2. Delivery (each step is one pull request that passes the done gate)

1. **R1 — Design system.** Tokens (cream, lavender/plum, coral, mint, sky, butter), Baloo 2 + Nunito fonts, mascots Coco, Mochi, Biscuit and Luna as original SVG components with moods and poses, motion utilities (lift, wave, pop, confetti) that honour reduced motion, restyled primitives, shell, landing, sign-in and sign-up, design gallery page.
2. **R2 — Business dashboard.** *(Shipped: seven tiles; reviews and loyalty tiles join in R5 when their data exists.)* Greeting with a mascot and a message from real data; eight tiles (today, requests, groomers, customers & pets, services, revenue, reviews, loyalty) each with a statistic, description and action; drag to reorder (dnd-kit, keyboard and touch sensors), resize, pin, hide, saved per user and business. Business achievements with progress, switchable off.
3. **R3 — Customer portal.** *(Shipped, including front-desk confirm/decline of requests; open acceptance by groomers, automatic allocation and notifications are R4.)* Customer accounts (same Supabase Auth; a person can be staff, customer or both). Verified-email claim links existing business customer records (no second registration). Owner pet profiles with photos; listed businesses to browse; the seven-step booking request; status tracking; history.
4. **R4 — Marketplace.** *(Shipped. Reminders are created when the app is opened; email/SMS delivery waits for a provider.)* Request queue for the business; allocation modes (automatic, manual review, open to eligible groomers, assigned groomer only); acceptance deadlines; groomer shift board with Accept; atomic acceptance in one database function (row lock + availability + capability + no-overlap constraint) so only one groomer can win; reassign, reject, close, expire; in-app notifications with pet-friendly templates and a delivery outbox ready for email/SMS.
5. **R5 — Gamification, reviews and polish.** Reusable engine: point rules per business, a points ledger (earned and redeemed, unique per source event), badges and levels for customers and businesses, streaks, birthday rewards, reward catalogue; reviews of completed appointments; calendar month view; end-to-end tests across owner, groomer and customer, including concurrent acceptance.

## 3. Data model (new tables; all with RLS and cross-tenant tests)

- `customer_accounts`: `customers.account_user_id` links a business customer record to a signed-in person. `claim_customer_records()` (definer) links records whose contact email equals the caller's **verified** email.
- `owner_pets` (user-owned profile: name, species, breed, birth date or estimated age, weight, size, coat, grooming preferences, handling and care notes, photo); `pets.owner_pet_id` links each business pet to it. Owner edits flow to linked business pets by trigger; staff notes stay business-only.
- `marketplace_profiles` (opt-in listing per business: blurb, suburb, cover, accepting requests).
- `booking_requests` + `booking_request_services` + `booking_request_events` (history). Status enum: draft, submitted, awaiting_review, open, accepted, confirmed, in_progress, completed, cancelled, rejected, expired. Transitions only through definer functions; appointment progress mirrors onto the request.
- `booking_policies` gains allocation mode, review requirement and acceptance deadline. `member_services` (which services a groomer may do; none listed = all).
- `notifications` (recipient, business, kind, data, read) and `notification_deliveries` (channel email/sms, status) — in-app now, outbox for later channels.
- `reviews` (one per completed appointment, by its customer).
- `loyalty_settings`, `loyalty_rewards`, `points_ledger` (unique `(business_id, customer_id, source)`), `achievement_awards` (unique per subject + key), `dashboard_layouts`.

## 4. Rules carried from CLAUDE.md and the brief

- Requests are never confirmed before the database has validated availability; no overlapping appointments for a groomer (existing constraint); no acceptance outside working hours or capability.
- Points only for completed, eligible appointments — never for submitting a request; duplicate awards are impossible (unique keys); gamification never changes prices, availability or payments.
- Groomers still never see customer contact details; customers see only their own records; businesses never see each other.
- No fabricated data in production paths: demo businesses, pets and photos live in `supabase/seed.sql` only, marked as test data.
- Every tile and button works, or it isn't shown.

## 5. Risks

- **Scope.** Five pull requests; each ships working, tested functionality rather than partial screens.
- **Illustration quality.** Mascots are hand-built SVG (scalable, themeable, transparent). They can be replaced by commissioned artwork later without code changes (one component).
- **Linking accounts to existing customers** relies on verified email; a phone-only customer is linked by the business inviting them later.
- **Concurrency.** Covered by a row lock in one function plus the existing exclusion constraint, with a concurrent database test.
