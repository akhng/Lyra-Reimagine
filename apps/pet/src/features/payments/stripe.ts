import "server-only";
import Stripe from "stripe";
import type { PaymentsProvider } from "./provider";

/**
 * Stripe Connect (ADR 0004). Salons own standard-style connected accounts
 * (full Stripe dashboard, Stripe collects their details). Payments are direct
 * charges on the salon's account: the salon is the merchant and pays Stripe's
 * fees; Lyra Pet's 5% is the application fee. Refunds return the fee too.
 */
export function stripeProvider(secretKey: string, webhookSecret: string | undefined): PaymentsProvider {
  const stripe = new Stripe(secretKey, { appInfo: { name: "Lyra Pet" }, maxNetworkRetries: 2 });
  return {
    async createAccount({ businessName, email }) {
      const a = await stripe.accounts.create({
        country: "AU",
        email: email ?? undefined,
        business_profile: { name: businessName },
        controller: { fees: { payer: "account" }, losses: { payments: "stripe" }, stripe_dashboard: { type: "full" }, requirement_collection: "stripe" },
      });
      return a.id;
    },
    async onboardingLink(account, returnUrl, refreshUrl) {
      return (await stripe.accountLinks.create({ account, return_url: returnUrl, refresh_url: refreshUrl, type: "account_onboarding" })).url;
    },
    async dashboardLink() {
      // Full-dashboard accounts sign in to Stripe directly.
      return "https://dashboard.stripe.com/";
    },
    async getAccount(account) {
      const a = await stripe.accounts.retrieve(account);
      return { id: a.id, chargesEnabled: !!a.charges_enabled, payoutsEnabled: !!a.payouts_enabled, detailsSubmitted: !!a.details_submitted };
    },
    async createCheckout(i) {
      const s = await stripe.checkout.sessions.create(
        {
          mode: "payment",
          line_items: [{ quantity: 1, price_data: { currency: "aud", unit_amount: i.amountCents, product_data: { name: i.description } } }],
          payment_intent_data: { application_fee_amount: i.feeCents, metadata: { request_id: i.requestId } },
          metadata: { request_id: i.requestId },
          customer_email: i.customerEmail ?? undefined,
          success_url: i.successUrl,
          cancel_url: i.cancelUrl,
          expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
        },
        { stripeAccount: i.account },
      );
      return { id: s.id, url: s.url ?? "", paid: s.payment_status === "paid", paymentIntent: typeof s.payment_intent === "string" ? s.payment_intent : (s.payment_intent?.id ?? null) };
    },
    async getCheckout(account, sessionId) {
      const s = await stripe.checkout.sessions.retrieve(sessionId, { stripeAccount: account });
      return { id: s.id, url: s.url ?? "", paid: s.payment_status === "paid", paymentIntent: typeof s.payment_intent === "string" ? s.payment_intent : (s.payment_intent?.id ?? null) };
    },
    async refund(account, paymentIntent) {
      return (await stripe.refunds.create({ payment_intent: paymentIntent, refund_application_fee: true }, { stripeAccount: account })).id;
    },
    parseWebhook(body, signature) {
      if (!webhookSecret) throw new Error("webhook secret missing");
      const e = stripe.webhooks.constructEvent(body, signature, webhookSecret);
      return { type: e.type, account: e.account ?? null, object: e.data.object };
    },
  };
}
