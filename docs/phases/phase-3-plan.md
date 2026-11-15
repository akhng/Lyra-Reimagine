# Lyra Pet — Phase 3 plan: scheduling and the booking portal

Scope from the master brief and roadmap: calendars, a booking engine with database-level overlap prevention, a public booking portal, recurring bookings, cancellations and a waitlist. Notifications and payments are Phase 4.

## Data (migration `20261117000000_scheduling.sql`)

- **Opening hours** `location_hours` (location, weekday, opens, closes; several rows per day allowed for split shifts) and **staff hours** `staff_hours` (member, location, weekday, starts, ends). Times are local wall-clock times in the location's time zone (default: business time zone).
- **Time off** `staff_time_off` (member, starts_at, ends_at) and **closures** `business_closures` (whole business or one location, a date range, e.g. public holidays).
- **Booking policy** `booking_policies` (online booking on/off, minimum notice, how far ahead, slot step, cancellation window in hours, policy text shown to customers).
- **Appointments** `appointments` (location, customer, pet, groomer, start, service end, block end including clean-up buffer, status, source staff/online, notes, price estimate, recurring series, grooming record, manage-token hash, cancellation details) and `appointment_services` (a snapshot of each service's name, duration and price).
  - **No double-booking in the database:** an exclusion constraint (`btree_gist`) on (groomer, time range) for every appointment that isn't cancelled or a no-show. Two simultaneous inserts can't both succeed.
- **Recurring series** `appointment_series` (interval in weeks, how many); each occurrence is a normal appointment.
- **Waitlist** `waitlist_entries` (customer, pet, services, preferred groomer, earliest and latest date, status waiting/offered/booked/cancelled).
- **RLS:** all staff read; owner, manager and reception write. Groomers change the status of their **own** appointments through `set_appointment_status()`. Groomers still don't see contact details.

## Public booking (no customer accounts)

Anonymous visitors never read tables. Security-definer functions expose only what booking needs:
- `booking_context(slug, from, to)`: business name, policy, locations and hours, online-bookable services and prices, groomer display names, staff hours, and busy intervals with **no customer data**.
- `create_online_booking(...)`: re-checks everything on the server (online booking on, services bookable, notice and horizon, inside opening and staff hours, not on time off or a closure, overlap via the constraint). It finds or creates the customer and pet, and returns a one-time manage token (only its SHA-256 hash is stored). It is rate limited per business, per email and per client.
- `get_booking_by_token`, `cancel_booking_by_token` (within the cancellation window) and `reschedule_booking_by_token`.
- Spam protection: a honeypot field, a minimum fill time, and server-side rate limits.

## Availability engine

Pure TypeScript (`features/scheduling/availability.ts`), unit-tested across daylight-saving changes. It takes opening hours ∩ staff hours, minus time off, closures and busy blocks, then applies minimum notice, horizon and slot step. The database re-checks every booking, so the engine is for display only.

## Staff screens

Calendar: a day view with groomer columns and a week view per groomer, with drag-to-reschedule on desktop and a list on phones. Also: new appointment (customer → pet → services → groomer → time, with a live estimate), appointment detail (status buttons, reschedule form, cancel, "Record groom"), recurring bookings, the waitlist (with openings found by the engine), and Hours & booking settings. The dashboard gains today's timeline and appointment counts.

## Decisions

- Staff may book outside a groomer's hours (salons do), but never on top of another appointment. Online bookings must fit the hours.
- Without email or SMS yet (Phase 4), the confirmation page offers "Add to calendar" (.ics) and the private manage link. The salon sees online bookings immediately.
- No deposits until Stripe (Phase 4).

## Risks

- Time zones: every local-time computation goes through one tested module.
- Abuse of the public endpoints: rate limits in the database plus a honeypot. Turnstile/CAPTCHA can be added later if needed (third-party service).
