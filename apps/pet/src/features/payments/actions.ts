"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@lyra/platform/auth/session";
import { serverEnv } from "@lyra/platform/env";
import { logger } from "@lyra/platform/logger";
import { createSupabaseServerClient } from "@lyra/platform/supabase/server";
import { requireBusiness } from "@lyra/platform/tenancy/context";
import { markFakePaid } from "./fake";
import { paymentsProvider, startCheckout, syncAccount } from "./service";

/** Payment actions: salons connect Stripe; customers pay. Amounts and fees are set on the server and in the database. */
export async function connectStripeAction(slug: string): Promise<{ ok: false; error: string } | never> {
  const ctx = await requireBusiness(slug);
  if (ctx.role !== "owner") return { ok: false, error: "Only the business owner can connect payments." };
  const provider = paymentsProvider();
  if (!provider) return { ok: false, error: "Payments aren't set up for Lyra Pet yet." };
  const db = await createSupabaseServerClient();
  const { data: existing } = await db.from("payment_accounts").select("stripe_account_id").eq("business_id", ctx.business.id).maybeSingle();
  const user = await requireUser();
  let account = existing?.stripe_account_id;
  let url: string;
  try {
    if (!account) {
      account = await provider.createAccount({ businessName: ctx.business.name, email: user.email });
      await syncAccount(ctx.business.id, account);
    }
    const base = `${serverEnv().APP_URL}/b/${slug}/payments`;
    url = await provider.onboardingLink(account, `${base}?returned=1`, `${base}?refresh=1`);
  } catch (e) {
    logger.warn({ businessId: ctx.business.id, err: e instanceof Error ? e.message.slice(0, 80) : "unknown" }, "stripe connect failed");
    return { ok: false, error: "We couldn't reach Stripe. Please try again." };
  }
  redirect(url);
}

export async function payRequestAction(requestId: string): Promise<{ ok: false; error: string } | never> {
  const user = await requireUser();
  if (!z.uuid().safeParse(requestId).success) return { ok: false, error: "That request isn't available." };
  let result: Awaited<ReturnType<typeof startCheckout>>;
  try {
    result = await startCheckout(requestId, user.email);
  } catch (e) {
    logger.warn({ requestId, err: e instanceof Error ? e.message.slice(0, 80) : "unknown" }, "checkout failed");
    return { ok: false, error: "We couldn't start the payment. Please try again." };
  }
  if (!result.ok) return result;
  redirect(result.url);
}

/** Test-only: marks a fake checkout session paid. Refused unless the fake provider is active outside production. */
export async function fakePayAction(session: string): Promise<void> {
  await requireUser();
  if (serverEnv().PAYMENTS_PROVIDER !== "fake" || process.env.VERCEL_ENV === "production" || !/^cs_test_[a-f0-9]+$/.test(session)) return;
  markFakePaid(session);
}
