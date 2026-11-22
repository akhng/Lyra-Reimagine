# Private messages report (ADR 0005)

## What was built

### Pet owners
- A **Message** button on every salon's page. It works with or without a booking.
- **Messages** in the navigation, with an unread dot.
- `/me/messages`: the list of conversations.
- `/me/messages/[id]`: the conversation, with:
  - live updates;
  - the "who can see this" notice;
  - a note when contact details are hidden;
  - Block and Report.

### Salons
- **Messages** in the staff navigation, with an unread count.
- `/b/[slug]/messages`: a list with "New" and "Reported" badges.
- The conversation page, with this owner's recent requests beside it (pet, services, status, time; no contact details).
- Owners and managers see open reports and can mark them handled. The front desk can block.

### Database
- **Migration** `20261123000000_messaging.sql`:
  - 4 tables with RLS, writes only through definer functions;
  - contact-detail masking;
  - fair-use limits;
  - hourly-deduplicated notifications;
  - Realtime publication.
- **Notifications:** `message_new` and `message_reported`, with wording and links for each side.
- **Security policy (CSP):** `connect-src` now allows the Supabase Realtime websocket.
- **Local development:** Realtime is now enabled in `supabase/config.toml`.

## Tests
- `pnpm check`: lint, typecheck, 48 unit tests and build all pass.
- `pnpm db:test`: 78 pass, including 7 new messaging tests:
  - starting a conversation without a booking, once per salon, and refusing your own salon;
  - first name only;
  - masking (phone, email, links) and unlocking after a paid booking;
  - other salons, other owners and groomers without a booking are kept out;
  - no direct writes;
  - a groomer joins once a request is assigned;
  - unread state for each side;
  - block and unblock rules;
  - reports and resolving;
  - message length and burst limits.
- `pnpm test:e2e`: 48 pass at 1440, 820 and 390 px with axe checks. New tests:
  - the pet owner and salon chat before a booking: masked number, reply, "New" badge, a groomer without a booking sees nothing, block;
  - **live delivery**: a message appears in the other person's open conversation within seconds, without a reload.

## Fixes along the way
- `customer-portal.spec.ts`: the favourites click now retries until the page is interactive. It sometimes clicked before hydration, which got more likely once the layout made one more query.

## Gaps and notes
- Masking is best-effort (spelled-out numbers get through). Reports and owner oversight are the backstop.
- Not in this phase: photo attachments, typing indicators, message deletion, and email or SMS for messages.
- Production: Realtime is on by default in Supabase cloud. If live updates don't appear, check Database → Replication shows `chat_messages` in `supabase_realtime`. The migration adds it.
