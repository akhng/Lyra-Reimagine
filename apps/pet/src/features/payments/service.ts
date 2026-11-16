import "server-only";
import { serverEnv } from "@lyra/platform/env";
import { logger } from "@lyra/platform/logger";
import { createSupabaseAdminClient } from "@lyra/platform/supabase/admin";
import { createSupabaseServerClient } from "@lyra/platform/supabase/server";
import { fakeProvider } from "./fake";
import { FEE_BPS } from "./fees";
import type { PaymentsProvider } from "./provider";
import { stripeProvider } from "./stripe";

/**
 * Payments orchestration (ADR 0004). The service-role client is used only to
 * record what Stripe confirmed (paid, refunded, account status) through the
 * dedicated database functions, always for a row identified by a Stripe id
 * or a business already checked on the server.
 */
export function paymentsProvider(): PaymentsProvider | null {
  const env = serverEnv();
  if (env.PAYMENTS_PROVIDER === "fake") {
    // Test-only stand-in; never in production.
    if (process.env.VERCEL_ENV === "production") return null;
    return fakeProvider(env.APP_URL);
  }
  return env.STRIPE_SECRET_KEY ? stripeProvider(env.STRIPE_SECRET_KEY, env.STRIPE_WEBHOOK_SECRET) : null;
}

export async function syncAccount(businessId: string, accountId: string): Promise<void> {
  const provider = paymentsProvider();
  if (!provider) return;
  const a = await provider.getAccount(accountId);
  const { error } = await createSupabaseAdminClient().rpc("sync_payment_account", { p_business: businessId, p_account: a.id, p_charges: a.chargesEnabled, p_payouts: a.payoutsEnabled, p_details: a.detailsSubmitted });
  if (error) throw new Error(`account sync failed: ${error.code}`);
}

/** Starts Stripe Checkout for a draft request owned by the signed-in customer. Returns the URL to send them to. */
export async function startCheckout(requestId: string, customerEmail: string | null): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const provider = paymentsProvider();
  if (!provider) return { ok: false, error: "Online payment isn't available right now." };
  const db = await createSupabaseServerClient();
  const { data: r } = await db.from("booking_requests").select("id, business_id, status, estimate_cents, pets!booking_requests_pet_id_business_id_fkey(name), booking_request_services(name, position)").eq("id", requestId).maybeSingle();
  if (!r || r.status !== "draft" || !r.estimate_cents) return { ok: false, error: "This request doesn't need paying." };
  // Customers can't read salons' payment accounts (RLS); the server reads the account id for the request's salon.
  const { data: acct } = await createSupabaseAdminClient().from("payment_accounts").select("stripe_account_id, charges_enabled").eq("business_id", r.business_id).maybeSingle();
  if (!acct?.charges_enabled) return { ok: false, error: "This salon isn't taking online payments right now." };
  const env = serverEnv();
  const services = [...(r.booking_request_services as Array<{ name: string; position: number }>)].sort((a, b) => a.position - b.position).map((s) => s.name).join(", ");
  const pet = (r.pets as unknown as { name: string } | null)?.name ?? "your pet";
  const session = await provider.createCheckout({
    account: acct.stripe_account_id,
    amountCents: r.estimate_cents,
    feeCents: Math.round((r.estimate_cents * FEE_BPS) / 10_000),
    // Stripe Checkout shows the salon's own business name (it's their account).
    description: `${services} for ${pet}`,
    customerEmail,
    requestId: r.id,
    successUrl: `${env.APP_URL}/me/requests/${r.id}?paid={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${env.APP_URL}/me/requests/${r.id}?cancelled=1`,
  });
  const { error } = await db.rpc("record_checkout", { p_request: r.id, p_session: session.id, p_fee_bps: FEE_BPS });
  if (error) {
    logger.warn({ requestId: r.id, code: error.code }, "record checkout failed");
    return { ok: false, error: "We couldn't start the payment. Please try again." };
  }
  return { ok: true, url: session.url };
}

/** After Stripe sends the customer back: confirm with Stripe (webhooks may lag) and record a successful payment. */
export async function confirmCheckout(requestId: string, sessionId: string): Promise<boolean> {
  const provider = paymentsProvider();
  if (!provider || !/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return false;
  const db = await createSupabaseServerClient();
  // RLS: the requester can read their own payment row; that's what ties this session to them.
  const { data: p } = await db.from("payments").select("stripe_account_id, status").eq("request_id", requestId).eq("stripe_checkout_session_id", sessionId).maybeSingle();
  if (!p) return false;
  if (p.status === "paid") return true;
  const s = await provider.getCheckout(p.stripe_account_id, sessionId);
  if (!s.paid) return false;
  const { error } = await createSupabaseAdminClient().rpc("mark_payment_paid", { p_session: sessionId, p_intent: s.paymentIntent ?? "" });
  if (error) throw new Error(`mark paid failed: ${error.code}`);
  return true;
}

/** Refunds payments that became refund_due (declined, expired or cancelled requests). Safe to call repeatedly. */
export async function processRefunds(businessId?: string): Promise<number> {
  const provider = paymentsProvider();
  if (!provider) return 0;
  const admin = createSupabaseAdminClient();
  let q = admin.from("payments").select("id, stripe_account_id, stripe_payment_intent_id").eq("status", "refund_due").limit(20);
  if (businessId) q = q.eq("business_id", businessId);
  const { data } = await q;
  let n = 0;
  for (const p of data ?? []) {
    if (!p.stripe_payment_intent_id) continue;
    try {
      const refund = await provider.refund(p.stripe_account_id, p.stripe_payment_intent_id);
      await admin.rpc("mark_payment_refunded", { p_payment: p.id, p_refund: refund });
      n++;
    } catch (e) {
      logger.warn({ paymentId: p.id, err: e instanceof Error ? e.message.slice(0, 80) : "unknown" }, "refund failed; will retry");
    }
  }
  return n;
}
