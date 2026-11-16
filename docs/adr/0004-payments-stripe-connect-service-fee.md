# ADR 0004: Payments through Stripe Connect with a 5% service fee

- Status: accepted
- Date: 2026-11-16
- Decision owner: product owner (chose "Option A, 5% including GST, salon pays Stripe fees, payment in full at booking")

## Context

Lyra Pet is free for salons. The business earns money from bookings that customers pay for through the app. Lyra Pet must never hold salons' money, see card details or act as a payments business. Under the Australian Consumer Law, customers need clear prices and refunds.

## Decision

1. **Stripe Connect, direct charges.** Each salon connects its own Stripe account (Stripe-hosted onboarding, full Stripe Dashboard, `controller.fees.payer = account`, `losses.payments = stripe`). Charges are created **on the salon's account**, so the salon is the merchant of record, its business name shows on the customer's statement, and Stripe pays out to the salon's bank.
2. **Service fee: 5% of the amount paid, GST included.** It is collected as Stripe's `application_fee_amount` on each charge. `FEE_BPS = 500` in `features/payments/fees.ts`, and the database function `record_checkout` refuses any other basis. The fee is calculated from the request's estimate in the database, never from what the client sends.
3. **The salon pays Stripe's processing fees.** These are charged to the salon's account because the charge is direct. Lyra Pet's fee is separate.
4. **Payment in full at booking.** When a salon takes online payments, a new request stays a `draft` until Stripe Checkout succeeds. Only then is it routed (manual review, shift board or automatic). Unpaid drafts expire after 2 hours. Salons that haven't connected Stripe keep the earlier flow: the customer pays at the salon and there is no fee.
5. **Refunds are automatic and full.** When a paid request is declined, expires or is cancelled by the customer, the trigger `refund_on_request_end` marks the payment `refund_due`. The server then refunds it with `refund_application_fee: true`, so the customer gets everything back and Lyra Pet's fee is returned to the salon. Refunds are retried on page loads; each step is idempotent.
6. **Only Stripe-confirmed facts change payment state.** Payment rows have no client write grants. Service-role functions (`mark_payment_paid`, `mark_payment_refunded`, `mark_payment_failed`, `sync_payment_account`) are called after a signature-verified webhook, or after the server itself asks Stripe about the session.
   - If a superseded checkout is also paid, the duplicate is refunded.
   - If payment arrives after the draft lapsed, it is refunded.
7. **Statements and tax invoices.** Settings → Payments shows the month's paid bookings, the amount customers paid, fees and refunds. It also shows a tax invoice from the platform's legal entity (`PLATFORM_LEGAL_NAME`, `PLATFORM_ABN`) for the fees, with GST at one eleventh. The invoice is hidden until those details are configured.
8. **Test-only provider.** `PAYMENTS_PROVIDER=fake` swaps Stripe for an in-memory stand-in with a local checkout page (`/pay/test/<session>`), so e2e tests cover the flow. It is refused when `VERCEL_ENV=production`.

## Consequences

- Lyra Pet is not a payment facilitator and never holds funds. Chargeback and dispute losses sit with Stripe and the salon (direct charges), not the platform. This is reflected in the terms.
- **Price changes.** The fee is charged on the estimate. If the salon later changes the price at the counter (for example, a matted coat), the difference is settled at the salon, outside the app, and carries no fee. Partial refunds and price adjustments in the app are out of scope for this phase.
- **Fee GST.** If the platform entity isn't registered for GST, the "GST included" wording and the tax invoice must change. This is a legal and accounting check before launch.
- **Live verification.** Stripe API calls couldn't be exercised from the build environment. The integration is verified with the fake provider and must be checked in Stripe test mode before launch (see the payments report).
