# Transformation R4 report: request marketplace and notifications

## What was built
- Migration `20261120000000_request_marketplace.sql`: allocation modes, acceptance deadlines, commission and groomers-set-own-hours on the booking policy; `member_services` (capabilities); assigned/accepted groomer on requests; `notifications`; functions `accept_booking_request`, `open_booking_request`, `close_booking_request`, `shift_board`, `tidy_booking_requests`, `queue_my_reminders`, `save_my_hours`, plus internal routing (`route_new_request`, `auto_allocate`, `eligible_groomers`, `request_candidate_starts`, `accept_deadline_for`, `notify*`). The R3 request functions now route by allocation mode and notify.
- Shift board (`/b/<slug>/shifts`): request cards with Accept (and a time picker for flexible requests), my next two weeks, my working hours when allowed.
- Requests queue: Open to groomers (any eligible, or one), take back, deadline and assignment shown, "Accepted by" on handled requests.
- Settings → Request allocation: the four modes, deadline hours, commission, groomers setting their own hours, and which services each groomer does.
- Notifications: bell with unread count in both portals, notification pages with friendly mascot cards, mark all read.

## Decisions
- Unclaimed requests go back to the front desk at the deadline rather than expiring; only requests whose time has passed expire.
- Housekeeping runs on page loads instead of a scheduler (idempotent; no new infrastructure). A scheduled job can call the same functions later.
- Reminders appear in the app; there is no email/SMS provider yet, so nothing is sent externally and nothing pretends to be.
- The accept action doesn't revalidate the page, so the card can show its result (pages render on request anyway).

## Tests
| Check | Result |
|---|---|
| `pnpm check` (41 unit tests incl. notification wording and links) | pass |
| `pnpm db:test` (59; 9 new: open mode and board visibility across tenants and customers, **two groomers accepting at once — exactly one wins**, capability, hours, flexible windows, assigned-only and take-back, automatic allocation and its fallback, deadline return and expiry with outsider protection, notification privacy and progress, reminder dedupe, own-hours permission) | pass |
| `pnpm test:e2e` (36 at 1440/820/390 with axe; new: owner sets "open to groomers", two groomers see the request, one accepts, the other is told it's gone, owner and pet owner are notified, mark read) | pass |

## Gaps and what R5 assumes
- Email/SMS delivery needs a provider and credentials (Phase 4 of the original roadmap).
- Points, badges, levels, streaks, rewards, reviews and the calendar month view are R5.
