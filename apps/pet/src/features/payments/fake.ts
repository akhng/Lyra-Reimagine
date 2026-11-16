import "server-only";
import type { PaymentsProvider } from "./provider";

/**
 * A stand-in for Stripe used only by automated tests (PAYMENTS_PROVIDER=fake,
 * refused in production). Checkout "pays" through the local test page
 * /pay/test/<session>; accounts are always enabled. It never pretends to move money.
 */
const paid = new Set<string>();
export function markFakePaid(session: string) {
  paid.add(session);
}

export function fakeProvider(appUrl: string): PaymentsProvider {
  return {
    createAccount: async () => `acct_test${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`,
    onboardingLink: async (_account, returnUrl) => returnUrl,
    dashboardLink: async () => null,
    getAccount: async (id) => ({ id, chargesEnabled: true, payoutsEnabled: true, detailsSubmitted: true }),
    createCheckout: async (i) => {
      const id = `cs_test_${crypto.randomUUID().replaceAll("-", "")}`;
      return { id, url: `${appUrl}/pay/test/${id}?next=${encodeURIComponent(i.successUrl.replace("{CHECKOUT_SESSION_ID}", id))}`, paid: false, paymentIntent: null };
    },
    getCheckout: async (_account, id) => ({ id, url: "", paid: paid.has(id), paymentIntent: paid.has(id) ? `pi_test_${id.slice(8, 24)}` : null }),
    refund: async () => `re_test_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`,
    parseWebhook: () => {
      throw new Error("fake provider has no webhooks");
    },
  };
}
