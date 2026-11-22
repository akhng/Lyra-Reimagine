# ADR 0005: Private messages between pet owners and salons

- Status: accepted
- Date: 2026-11-22
- Decision owner: product owner (accepted all three recommendations: salon-level chat with the groomer included, owners and managers can read, contact details hidden until a paid booking)

## Context

Pet owners want to ask a salon questions before booking ("Do you groom anxious cavoodles?") and to talk to their groomer after booking. Two constraints shape the design:
- Groomers must not get customers' contact details (CLAUDE.md §6).
- Lyra Pet earns a 5% fee only on bookings paid through the app (ADR 0004), so an open chat invites taking the booking off the platform.

## Decision

1. **One conversation per pet owner and salon.**
   - The owner starts it from the salon's listing ("Message"), with or without a booking.
   - Bookings appear beside the conversation on the salon side.
2. **Who is in it:**
   - The salon's front desk (owner, manager, receptionist) always.
   - A groomer only while they have a current booking for that owner: an appointment from the last 30 days or later, or a request assigned to or accepted by them.
   - Owners and managers can read every conversation, and the pet owner is told so on the conversation page.
3. **Privacy:**
   - Staff see the owner's first name only, never their email or phone number. Pet owners see staff first names.
   - Message text is never logged.
   - Tables have RLS, and there are no direct client writes: everything goes through `security definer` functions that check `auth.uid()`.
4. **Contact details are hidden until a paid booking:**
   - `send_chat_message` replaces phone numbers, emails and links with "[number hidden]", "[contact hidden]" or "[link hidden]". It does this until the owner has paid for a booking through the app. At salons that don't take online payments, the condition is instead a confirmed or completed appointment.
   - Masking runs in the database, so no client can skip it.
   - It's best-effort: spelled-out numbers ("zero four one two…") and "name at gmail dot com" get through.
5. **Safety:**
   - Either side can block; only the side that blocked can unblock.
   - Either side can report; owners and managers are notified and mark reports handled.
   - Fair use: 10 messages a minute and 300 a day per person; 5 reports a day.
6. **Live updates:**
   - New messages are published to Supabase Realtime (RLS applies to subscribers).
   - The browser subscribes with the signed-in person's token.
   - A 30-second refresh is the fallback.
   - Notifications are limited to one per conversation, recipient and hour.

## Consequences

- Local Supabase now runs Realtime (`supabase/config.toml`). The production Supabase project has Realtime on by default.
- **Staff sending to themselves:** a staff member who is also a pet owner can't message their own salon as a customer (`own_business`).
- **Not in this phase:** photo attachments, typing indicators, deleting messages, and emailing or texting messages.
