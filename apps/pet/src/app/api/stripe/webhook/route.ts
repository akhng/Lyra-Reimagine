import { logger } from "@lyra/platform/logger";
import { createSupabaseAdminClient } from "@lyra/platform/supabase/admin";
import { paymentsProvider, syncAccount } from "@/features/payments/service";

/**
 * Stripe Connect webhook (ADR 0004). Signature-verified; records only what
 * Stripe reports, through the payment database functions. Stripe retries
 * on any non-2xx, and every handler is idempotent.
 */
export async function POST(req: Request) {
  const provider = paymentsProvider();
  const signature = req.headers.get("stripe-signature");
  if (!provider || !signature) return new Response("not configured", { status: 400 });
  let event;
  try {
    event = provider.parseWebhook(await req.text(), signature);
  } catch {
    return new Response("bad signature", { status: 400 });
  }
  // Service role: webhooks have no user session; rows are identified by Stripe ids.
  const admin = createSupabaseAdminClient();
  const o = event.object as { id?: string; payment_intent?: string | { id: string } | null; payment_status?: string };
  try {
    if ((event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") && o.id && o.payment_status === "paid") {
      const intent = typeof o.payment_intent === "string" ? o.payment_intent : (o.payment_intent?.id ?? "");
      const { error } = await admin.rpc("mark_payment_paid", { p_session: o.id, p_intent: intent });
      if (error && error.code !== "P0002") throw new Error(error.code);
    } else if ((event.type === "checkout.session.expired" || event.type === "checkout.session.async_payment_failed") && o.id) {
      await admin.rpc("mark_payment_failed", { p_session: o.id });
    } else if (event.type === "account.updated" && o.id) {
      const { data } = await admin.from("payment_accounts").select("business_id").eq("stripe_account_id", o.id).maybeSingle();
      if (data) await syncAccount(data.business_id, o.id);
    }
  } catch (e) {
    logger.error({ type: event.type, err: e instanceof Error ? e.message.slice(0, 80) : "unknown" }, "stripe webhook failed");
    return new Response("retry", { status: 500 });
  }
  return Response.json({ received: true });
}
