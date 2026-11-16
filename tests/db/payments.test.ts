import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../packages/platform/src/database";
import { NED, OLIVIA, PAWS, adminClient, newUser, signedIn } from "./helpers";

/**
 * Payments (ADR 0004): with Stripe connected, requests are drafts until paid
 * in full; the 5% fee comes from the request amount, not the caller; paid
 * requests that end are refunded; only the server confirms payments; and
 * payment rows stay private.
 */
type Db = SupabaseClient<Database>;
const admin = adminClient();
const created: string[] = [];
let olivia: Db;
let ned: Db;
let owner: Db;
let ownerId = "";
let other: Db;
let pet = "";
let serviceId = "";
const TZ = "Australia/Melbourne";
function melbourne(days: number, hhmm: string): string {
  const base = new Date(Date.now() + days * 86_400_000);
  let date = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(base);
  if (new Date(`${date}T12:00:00Z`).getUTCDay() === 0) date = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(base.getTime() + 86_400_000));
  const guess = Date.parse(`${date}T${hhmm}:00Z`);
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(guess)).map((p) => [p.type, p.value]));
  return new Date(guess - (Date.parse(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:00Z`) - guess)).toISOString();
}
const submit = async (days: number) => {
  const r = await owner.rpc("submit_booking_request", { p_slug: "paws-test", p_owner_pet: pet, p_service_ids: [serviceId], p_preferred_start: melbourne(days, "10:00"), p_windows: [], p_notes: "" } as never);
  if (r.error) throw new Error(r.error.message);
  return r.data as unknown as string;
};
const reqStatus = async (id: string) => (await admin.from("booking_requests").select("status").eq("id", id).single()).data?.status;
const payment = async (id: string) => (await admin.from("payments").select("status, amount_cents, fee_cents, refund_reason").eq("request_id", id).order("created_at", { ascending: false }).limit(1).single()).data;

beforeAll(async () => {
  olivia = await signedIn(OLIVIA);
  ned = await signedIn(NED);
  const u = await newUser("pay-owner");
  created.push(u.id);
  ownerId = u.id;
  owner = await signedIn({ email: u.email, password: "a-strong-passphrase-42" });
  const o = await newUser("pay-other");
  created.push(o.id);
  other = await signedIn({ email: o.email, password: "a-strong-passphrase-42" });
  serviceId = (await admin.from("services").insert({ business_id: PAWS, name: "Pay Full groom", duration_minutes: 60, base_price_cents: 9500, bookable_online: true }).select("id").single()).data?.id ?? "";
  await admin.from("marketplace_profiles").upsert({ business_id: PAWS, listed: true });
  pet = (await owner.from("owner_pets").insert({ user_id: u.id, name: "Mochi", species: "cat" }).select("id").single()).data?.id ?? "";
});

afterAll(async () => {
  await admin.from("booking_requests").delete().eq("business_id", PAWS);
  await admin.from("payment_accounts").delete().eq("business_id", PAWS);
  await admin.from("marketplace_profiles").delete().eq("business_id", PAWS);
  await admin.from("services").delete().eq("id", serviceId);
  for (const id of created) await admin.auth.admin.deleteUser(id);
});

describe("without Stripe connected", () => {
  it("routes requests as before (pay at the salon, no fee)", async () => {
    const id = await submit(5);
    expect(await reqStatus(id)).toBe("awaiting_review");
    expect((await owner.rpc("record_checkout", { p_request: id, p_session: "cs_test_a", p_fee_bps: 500 })).error?.message).toBe("not_payable");
    await admin.from("booking_requests").update({ status: "cancelled" }).eq("id", id);
  });
});

describe("with Stripe connected", () => {
  it("keeps a request as a draft until it's paid, then sends it to the salon", async () => {
    expect((await olivia.rpc("sync_payment_account", { p_business: PAWS, p_account: "acct_test123", p_charges: true, p_payouts: true, p_details: true })).error).not.toBeNull();
    await admin.rpc("sync_payment_account", { p_business: PAWS, p_account: "acct_test123", p_charges: true, p_payouts: true, p_details: true });
    const id = await submit(6);
    expect(await reqStatus(id)).toBe("draft");
    expect((await olivia.from("booking_requests").select("id").eq("id", id).eq("status", "awaiting_review")).data).toEqual([]);
    expect((await other.rpc("record_checkout", { p_request: id, p_session: "cs_test_x", p_fee_bps: 500 })).error?.message).toBe("not_found");
    expect((await owner.rpc("record_checkout", { p_request: id, p_session: "cs_test_b", p_fee_bps: 900 })).error?.message).toBe("invalid_fee");
    expect((await owner.rpc("record_checkout", { p_request: id, p_session: "cs_test_b", p_fee_bps: 500 })).error).toBeNull();
    expect(await payment(id)).toMatchObject({ status: "pending", amount_cents: 9500, fee_cents: 475 });
    // Only the server (service role) can confirm a payment.
    expect((await owner.rpc("mark_payment_paid", { p_session: "cs_test_b", p_intent: "pi_x" })).error).not.toBeNull();
    await admin.rpc("mark_payment_paid", { p_session: "cs_test_b", p_intent: "pi_test_b" });
    await admin.rpc("mark_payment_paid", { p_session: "cs_test_b", p_intent: "pi_test_b" });
    expect(await payment(id)).toMatchObject({ status: "paid" });
    expect(await reqStatus(id)).toBe("awaiting_review");
  });

  it("refunds a paid request that's declined, and lets unpaid drafts lapse", async () => {
    const id = await submit(7);
    await owner.rpc("record_checkout", { p_request: id, p_session: "cs_test_c", p_fee_bps: 500 });
    await admin.rpc("mark_payment_paid", { p_session: "cs_test_c", p_intent: "pi_test_c" });
    await olivia.rpc("review_booking_request", { p_id: id, p_action: "reject", p_groomer: null, p_starts_at: null, p_reason: "Fully booked" } as never);
    expect(await payment(id)).toMatchObject({ status: "refund_due", refund_reason: "Declined by the salon" });
    const p = (await admin.from("payments").select("id").eq("request_id", id).single()).data?.id ?? "";
    await admin.rpc("mark_payment_refunded", { p_payment: p, p_refund: "re_test" });
    expect(await payment(id)).toMatchObject({ status: "refunded" });

    const draft = await submit(8);
    await admin.from("booking_requests").update({ created_at: new Date(Date.now() - 3 * 3_600_000).toISOString() }).eq("id", draft);
    await owner.rpc("tidy_booking_requests", { p_business: PAWS });
    expect(await reqStatus(draft)).toBe("expired");
  });

  it("refunds when the customer cancels a paid request, and keeps payments private", async () => {
    const id = await submit(9);
    await owner.rpc("record_checkout", { p_request: id, p_session: "cs_test_d", p_fee_bps: 500 });
    await admin.rpc("mark_payment_paid", { p_session: "cs_test_d", p_intent: "pi_test_d" });
    expect((await owner.from("payments").select("status").eq("request_id", id).single()).data?.status).toBe("paid");
    expect((await other.from("payments").select("id").eq("request_id", id)).data).toEqual([]);
    expect((await ned.from("payments").select("id").eq("request_id", id)).data).toEqual([]);
    expect((await olivia.from("payments").select("status").eq("request_id", id).single()).data?.status).toBe("paid");
    expect((await owner.from("payments").update({ status: "refunded" }).eq("request_id", id)).error).not.toBeNull();
    await owner.rpc("cancel_booking_request", { p_id: id, p_reason: "" });
    expect(await payment(id)).toMatchObject({ status: "refund_due", refund_reason: "Cancelled" });
    expect((await ned.from("payment_accounts").select("business_id").eq("business_id", PAWS)).data).toEqual([]);
    void ownerId;
  });
});
