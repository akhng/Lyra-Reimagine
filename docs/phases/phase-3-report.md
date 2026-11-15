# Lyra Pet — Phase 3 report: scheduling and the booking portal

## What was built

- **Database** (`supabase/migrations/20261117000000_scheduling.sql`): opening hours, staff hours, time off, closures, booking policy, appointments (with a no-double-booking exclusion constraint), appointment services, recurring series, waitlist, booking-attempt rate limits; RLS on every table; `set_appointment_status()`; public booking functions for anonymous visitors.
- **Availability engine** (`apps/pet/src/features/scheduling/availability.ts`, `time.ts`): pure, time-zone and daylight-saving safe.
- **Staff screens:** Calendar (day view with groomer columns, week view per groomer, drag to move on desktop, a list on phones), New appointment (customer → pet → services → groomer → free times, live estimate, repeats), appointment detail (status buttons, reschedule, cancel, notes, "Record groom" linked to the grooming record), Waitlist (with free openings), Settings → Hours & online booking. The dashboard has today's timeline, appointment counts and setup steps; pet and customer pages have Book buttons and upcoming appointments.
- **Public booking portal** `/book/<slug>`: choose services, a day and a time (any or a specific groomer), details for a new or returning customer and pet, policy agreement and optional marketing consent. The private manage link `/book/manage/<token>` shows the booking, adds it to a calendar (`.ics`), changes the time or cancels within the cancellation window.

## Decisions

- Staff may book outside a groomer's hours, never on top of another appointment; online bookings must fit the hours and the policy (notice, horizon, slot step).
- No email or SMS until Phase 4: confirmation is the manage page plus `.ics`. No deposits until Stripe (Phase 4).
- The booking link uses the app's own address (`/book/<slug>`). Online booking is **off** by default; owners turn it on under Settings → Hours & online booking, and only services marked "bookable online" appear.
- The manage token's hash isn't readable by staff (column-level grants), so only the customer holds a working link.
- Spam protection without third-party services: honeypot, 4-second minimum fill time, database rate limits. Turnstile can be added if abuse appears.

## Tests and results

| Check | Result |
|---|---|
| `pnpm check` (lint, typecheck, 29 unit tests including 7 availability/DST and .ics tests, build) | pass |
| `pnpm db:test` (36 tests; 17 new: overlap incl. concurrent inserts and buffers, tenancy, groomer status rules, hidden token hash, no deletes, hours permissions, waitlist, anonymous access, booking/view/reschedule/cancel by token, server re-checks, rate limits, online booking off) | pass |
| `pnpm test:e2e` (24 tests at 1440, 820 and 390 px with axe; 3 new scheduling flows: staff booking + clash refusal + statuses + reschedule + hours, public booking + .ics + change + cancel + 404/off states, groomer limits) | pass |

Screens were checked visually at 390 and 1440 px.

Fixed during e2e: the appointment query embedded `pets` ambiguously (two foreign keys from appointments to pets); it now names the relationship.

## Gaps and what the next phase assumes

- No notifications (Phase 4): the salon sees online bookings in the calendar and dashboard; customers rely on the manage link and `.ics`.
- Waitlist offers are manual (staff contact the customer); automatic offers need Phase 4 messaging.
- Rosters are weekly hours per staff member; rotating rosters and staff invitations are Phase 4.
- Not verified on the live Supabase project: the migration must be run in the SQL Editor (it needs the `btree_gist` and `pgcrypto` extensions, which the migration creates).
