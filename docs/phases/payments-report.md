# Payments report: Stripe Connect and a 5% service fee (ADR 0004)

## What was built

### Salon side
- **Settings → Payments** (owners and managers; only the owner can connect Stripe):
  - Connect Stripe through Stripe-hosted onboarding, and see the account status.
  - A plain explanation of the fee.
  - Monthly statement: paid bookings, amount customers paid, fees, refunds, and a per-payment table.
  - Tax invoice for the month's fees, with GST at 1/11.
- The **booking requests** page shows a "Paid $X" badge. Unpaid drafts are hidden from the salon.

### Customer side
- When the salon takes online payments, the review step of the booking wizard:
  - says "You'll pay $X securely with Stripe now…";
  - has the button "Pay $X and send", which goes to Stripe Checkout.
- On return, the request page confirms with Stripe and shows the celebration.
- A draft request page offers "Pay $X securely" and explains refunds and the 2-hour lapse.
- The request details show "Paid", "Refund on its way" or "Refunded".

### Server and database
- **Migration** `20261122000000_payments.sql`:
  - tables `payment_accounts` and `payments` with RLS;
  - definer functions;
  - the trigger `refund_on_request_end`;
  - `submit_booking_request` and `tidy_booking_requests` now support drafts that wait for payment;
  - `listing_pays_online`;
  - duplicate and late payments are refunded.
- **Webhook** `/api/stripe/webhook`: signature-verified and idempotent.
- **Refunds** run after a customer cancels, and whenever the salon's requests page or the customer's bookings load. They are safe to repeat; failures are retried.
- **Test provider** (`PAYMENTS_PROVIDER=fake`, refused in production) with the `/pay/test/<session>` page.

### Docs
- ADR 0004 and an ARCHITECTURE section.
- Drafts in `docs/legal/` that need legal review: `business-terms-draft.md` and `customer-terms-draft.md`.

## Fix to existing behaviour

Before this change, a booking request with **no notes**, or with only **flexible time windows**, failed with "We couldn't send your request". The action left those arguments out, so PostgREST couldn't find the function. It now sends them as `null`. The payments e2e test covers the no-notes path.

## Decisions
- **Direct charges on the salon's account.** The salon is the merchant of record, and Lyra Pet never holds funds (ADR 0004).
- **Fee on the estimate.** Any price change at the counter is settled at the salon with no fee. In-app adjustments and partial refunds are deferred.
- **Server-side confirmation on return**, as well as the webhook. Customers see "submitted" immediately even if the webhook lags.
- **Refunds return the application fee** (`refund_application_fee: true`), matching "fee returned on refunds" in the terms.
- **New dependency:** `stripe@17.7.0`, the official SDK. Payments were approved by the product owner.

## Tests
- `pnpm check`: lint, typecheck, unit tests and build all pass.
- `pnpm db:test`: 71 tests pass, including 5 payment tests:
  - without Stripe, nothing changes;
  - drafts until paid; the fee comes from the request; only the server confirms; idempotent;
  - declined → refund; drafts lapse;
  - customer cancels → refund; privacy across tenants and customers;
  - booking-page flag; a duplicate payment is refunded.
- `pnpm test:e2e`, with `payments.spec.ts` at 1440, 820 and 390 px plus axe checks:
  - the owner connects Stripe;
  - the customer pays at booking;
  - the salon sees "Paid" and the fee on the statement ($4.75, GST $0.43);
  - declining refunds the customer.

## Not verified here
- **Live Stripe.** The build environment can't reach api.stripe.com and has no Stripe keys. Everything Stripe-specific in `features/payments/stripe.ts` and the webhook signature check is untested against real Stripe. Before launch, run a Stripe **test-mode** check:
  1. Connect a salon, using an Australian test account.
  2. Pay with card `4242 4242 4242 4242`.
  3. Check in the Stripe Dashboard that the application fee is 5% and that the connected account pays Stripe's fee.
  4. Decline the request and check the refund (the fee should be reversed).
  5. Let a Checkout session expire.
  6. Confirm that `account.updated` arrives.
- **Legal and tax.** The terms are drafts. Confirm the platform entity's GST registration ("GST included" depends on it) and the tax-invoice format with an accountant.

## Setup required (product owner)
1. Create a Stripe account for the platform and enable **Connect**. Choose an Express or Standard-like setup with Stripe-hosted onboarding; the code creates accounts with the `controller` settings in ADR 0004.
2. In Vercel, add `STRIPE_SECRET_KEY` (start with the test key `sk_test_…`) and `STRIPE_WEBHOOK_SECRET`.
3. In Stripe → Developers → Webhooks:
   - add the endpoint `https://<your-site>/api/stripe/webhook`;
   - select **"Events on Connected accounts"**;
   - events: `checkout.session.completed`, `checkout.session.expired`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `account.updated`.
4. In Vercel, add `PLATFORM_LEGAL_NAME` and `PLATFORM_ABN`. Tax invoices stay hidden until both are set.
5. Run the migration `20261122000000_payments.sql` in the Supabase SQL Editor.

## Next phase assumes
Payments are recorded only through the definer functions. Any later in-app price adjustment must add a function that changes `payments` and refunds the difference.
