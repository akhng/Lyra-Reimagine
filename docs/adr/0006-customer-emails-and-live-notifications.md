# ADR 0006: Customer emails and live notifications

- Status: accepted
- Date: 2026-11-26
- Decision owner: product owner (asked for a declined-request email and live notices on the customer home; chose to build the email behind an interface, then Resend)

## Context

When a salon declined a booking request, the customer was told only inside the app (bell, request page, My bookings). Customers who weren't using the app at the time didn't find out, and the home page only updated on reload. Lyra Pet had no email service.

## Decision

1. **Email for declined requests**, queued in the database in the same transaction as the decline (a trigger on `notifications` writes `email_outbox`). An email can't be lost between "declined" and "send", and the queue retries failures.
2. **A swappable email provider** (`EmailProvider`): `none` (default, nothing sent), `resend` (chosen by the product owner; called over its REST API with no new dependency) and `fake` (tests only, delivers to Mailpit). Changing service later is one provider file.
3. **Emails are skipped when more than a day old**, so switching a provider on later doesn't send a backlog of stale news.
4. **Live notifications via Supabase Realtime** on `notifications` (RLS applies), refreshing the server-rendered page. This is the pattern already used for private messages (ADR 0005).
5. **Unread "declined" notices on the customer home** (`/me`) until opened or dismissed.

## Consequences

- Only `request_rejected` sends an email for now. Other kinds (confirmed, cancelled by the salon, expired) need a template and one line in `queue_email_for_notification()`.
- Delivery runs from the app (after the decline, and on page loads), not a scheduled job. If nothing triggers it, a failed email waits for the next page load (up to 24 hours).
- Transactional booking emails don't need an unsubscribe under the Spam Act; any marketing email still needs consent and an unsubscribe (CLAUDE.md §7).
