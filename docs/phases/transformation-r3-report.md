# Transformation R3 report: customer portal and booking requests

## What was built
- Migration `20261119000000_customer_portal.sql`: customer accounts linked to business customer records (verified-email claim), owner pet profiles and photos, linked business pets with owner notes, marketplace listings, favourites, booking requests with services and status history, and the functions `claim_customer_records`, `submit_booking_request`, `review_booking_request`, `cancel_booking_request`, `my_bookings`, `marketplace_listings`, `marketplace_listing`, `toggle_favourite_business`, `my_favourite_slugs`; appointment progress mirrored onto requests.
- Pet owner portal `/me`: welcome with the day's mascot, illustrated pet cards (photo or mascot, breed, age, next appointment, last groom, preferences), tiles, add/edit pets with photo upload, salons with favourites, the seven-step booking request with a celebration on submit, bookings (waiting, upcoming, history, closed) and request tracking with cancel.
- Salon side: Requests queue (visual cards with pet photo, breed and size, services, requested time or flexible days, duration and estimate, customer and owner notes) with Confirm (groomer, date, time) and Decline (reason); Settings → Lyra Pet listing; owner notes on the pet page; the dashboard tile now counts requests.
- Sign-up asks "a pet owner" or "a grooming business"; `/home` routes accordingly; one account can be both.
- Pets without photos show a cat or dog mascot instead of an icon.

## Decisions
- Front-desk confirm/decline ships in R3 so the journey works end to end; groomer acceptance (open shifts), automatic allocation, deadlines, expiry and notifications are R4.
- Linking existing customers needs a verified email match; phone-only customers can be linked later by the salon.
- Staff can't edit the account link or the owner's notes (column grants; a table-level grant would override a column revoke).
- Fair use: three open requests per salon and ten new requests a day per person.

## Tests
| Check | Result |
|---|---|
| `pnpm check` (lint, typecheck, 39 unit tests, build) | pass |
| `pnpm db:test` (50; 11 new: owner pet privacy, listing visibility and editing roles, request creation and linking, cross-tenant and cross-customer isolation, owner edits flowing to the business pet, staff unable to change links or notes, bad input, confirm only by the front desk with hours and clash checks and no double confirmation, progress mirroring, cancel and reject, rate limit, claim by verified email) | pass |
| `pnpm test:e2e` (33 at 1440/820/390 with axe; new: salon lists → pet owner signs up, adds a pet, favourites and requests → front desk confirms → owner sees it confirmed; existing sign-up test now picks "a grooming business"; a date-dependent public booking test now books two days out) | pass |

## Gaps and what R4 assumes
- No notifications yet (in-app arrives in R4; email/SMS stay behind an interface until credentials exist).
- Requests don't expire automatically yet (R4 adds deadlines and expiry).
- Reviews, loyalty points and rewards are R5.
- Not verified against the live Supabase project: run the migration in the SQL Editor first.
