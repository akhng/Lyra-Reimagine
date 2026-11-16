import "server-only";
import { serverEnv } from "@lyra/platform/env";
import { createSupabaseServerClient } from "@lyra/platform/supabase/server";
import { paymentsProvider } from "./service";

/** Payment reads (RLS: owners/managers see the account; front desk sees payments; requesters see their own). */
export async function paymentAccount(businessId: string) {
  const db = await createSupabaseServerClient();
  const { data } = await db.from("payment_accounts").select("stripe_account_id, charges_enabled, payouts_enabled, details_submitted").eq("business_id", businessId).maybeSingle();
  return { configured: paymentsProvider() !== null, account: data };
}

export async function monthPayments(businessId: string, month: string) {
  const db = await createSupabaseServerClient();
  const start = `${month}-01T00:00:00Z`;
  const [y, m] = month.split("-").map(Number);
  const end = new Date(Date.UTC(y ?? 2026, m ?? 1, 1)).toISOString();
  const { data } = await db.from("payments").select("id, amount_cents, fee_cents, status, paid_at, refunded_at, created_at, booking_requests!inner(pets!booking_requests_pet_id_business_id_fkey(name))").eq("business_id", businessId).gte("created_at", start).lt("created_at", end).in("status", ["paid", "refunded", "refund_due"]).order("created_at");
  return (data ?? []).map((p) => ({ ...p, petName: (p.booking_requests as unknown as { pets: { name: string } | null } | null)?.pets?.name ?? "Pet" }));
}

export async function requestPayments(requestIds: string[]) {
  if (!requestIds.length) return new Map<string, { status: string; amount: number }>();
  const db = await createSupabaseServerClient();
  const { data } = await db.from("payments").select("request_id, status, amount_cents, created_at").in("request_id", requestIds).order("created_at");
  return new Map((data ?? []).map((p) => [p.request_id, { status: p.status, amount: p.amount_cents }]));
}

export function platformDetails() {
  const env = serverEnv();
  return { name: env.PLATFORM_LEGAL_NAME ?? null, abn: env.PLATFORM_ABN ?? null };
}
