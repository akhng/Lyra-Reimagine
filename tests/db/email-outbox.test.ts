import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../packages/platform/src/database";
import { NED, OLIVIA, PAWS, adminClient, anonClient, newUser, signedIn } from "./helpers";

/**
 * Customer emails: declining a request queues one email (with the reason) in
 * the same transaction as the in-app notification; nothing else is emailed;
 * only the service role can see or deliver the outbox.
 * Seed: Paws Test Salon works Mon–Sat 08:00–17:00 (Melbourne), owner Olivia.
 */
type Db = SupabaseClient<Database>;
const admin = adminClient();
const TZ = "Australia/Melbourne";
const created: string[] = [];
const requests: string[] = [];
let olivia: Db;
let ned: Db;
let customer: Db;
let customerId = "";
let serviceId = "";
let pet = "";
let groomerMember = "";

function melbourne(days: number, hhmm: string): string {
  const base = new Date(Date.now() + days * 86_400_000);
  let date = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(base);
  if (new Date(`${date}T12:00:00Z`).getUTCDay() === 0) date = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(base.getTime() + 86_400_000));
  const guess = Date.parse(`${date}T${hhmm}:00Z`);
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(guess)).map((p) => [p.type, p.value]));
  return new Date(guess - (Date.parse(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:00Z`) - guess)).toISOString();
}

async function submit(days: number): Promise<string> {
  const r = await customer.rpc("submit_booking_request", { p_slug: "paws-test", p_owner_pet: pet, p_service_ids: [serviceId], p_preferred_start: melbourne(days, "10:00"), p_windows: [], p_notes: "EM test" } as never);
  if (r.error) throw new Error(r.error.message);
  const id = r.data as unknown as string;
  requests.push(id);
  return id;
}
const outbox = (id: string) => admin.from("email_outbox").select("kind, status, user_id, data").eq("data->>requestId", id);

beforeAll(async () => {
  olivia = await signedIn(OLIVIA);
  ned = await signedIn(NED);
  groomerMember = (await admin.from("business_members").select("id").eq("business_id", PAWS).eq("user_id", OLIVIA.id).single()).data?.id ?? "";
  serviceId = (await admin.from("services").insert({ business_id: PAWS, name: "EM Full groom", duration_minutes: 60, base_price_cents: 9000, bookable_online: true }).select("id").single()).data?.id ?? "";
  await admin.from("marketplace_profiles").upsert({ business_id: PAWS, listed: true, accepting_requests: true });
  const u = await newUser("em-customer");
  created.push(u.id);
  customerId = u.id;
  customer = await signedIn({ email: u.email, password: u.password });
  pet = (await customer.from("owner_pets").insert({ user_id: u.id, name: "Pepper", species: "dog", size: "small" }).select("id").single()).data?.id ?? "";
});

afterAll(async () => {
  await admin.from("email_outbox").delete().eq("user_id", customerId);
  for (const id of requests) await admin.from("booking_requests").delete().eq("id", id);
  await admin.from("appointments").delete().eq("business_id", PAWS).like("customer_notes", "EM%");
  await admin.from("services").delete().eq("id", serviceId);
  await admin.from("marketplace_profiles").delete().eq("business_id", PAWS);
  for (const id of created) await admin.auth.admin.deleteUser(id);
});

describe("email outbox", () => {
  it("queues one email with the reason when the salon declines", async () => {
    const id = await submit(6);
    expect((await olivia.rpc("review_booking_request", { p_id: id, p_action: "reject", p_groomer: null, p_starts_at: null, p_reason: "Fully booked that week" } as never)).error).toBeNull();
    const { data } = await outbox(id);
    expect(data).toHaveLength(1);
    expect(data?.[0]).toMatchObject({ kind: "request_rejected", status: "pending", user_id: customerId, data: { petName: "Pepper", businessName: "Paws Test Salon", reason: "Fully booked that week", refund: false } });
  });

  it("doesn't email when the salon confirms", async () => {
    const id = await submit(7);
    const r = await olivia.rpc("review_booking_request", { p_id: id, p_action: "confirm", p_groomer: groomerMember, p_starts_at: melbourne(7, "10:00"), p_reason: null } as never);
    expect(r.error).toBeNull();
    expect((await outbox(id)).data).toEqual([]);
  });

  it("is invisible to customers, staff and anonymous visitors", async () => {
    for (const db of [customer, olivia, ned, anonClient()]) {
      expect((await db.from("email_outbox").select("id")).data ?? []).toEqual([]);
      expect((await db.from("email_outbox").update({ status: "sent" }).eq("user_id", customerId).select("id")).data ?? []).toEqual([]);
      expect((await db.rpc("claim_email_outbox", { p_limit: 5 })).error).not.toBeNull();
    }
  });

  it("delivery claims due emails once, and skips ones too old to send", async () => {
    const id = await submit(8);
    await olivia.rpc("review_booking_request", { p_id: id, p_action: "reject", p_groomer: null, p_starts_at: null, p_reason: "" } as never);
    // An old one (as if no provider was configured for a while) must not go out a day late.
    const old = (await admin.from("email_outbox").insert({ business_id: PAWS, user_id: customerId, kind: "request_rejected", data: { requestId: "old" }, dedupe_key: `old-${Date.now()}`, created_at: new Date(Date.now() - 25 * 3_600_000).toISOString() }).select("id").single()).data?.id;
    const first = (await admin.rpc("claim_email_outbox", { p_limit: 50 })).data ?? [];
    expect(first.map((e) => e.status)).not.toContain("pending");
    expect(first.some((e) => (e.data as { requestId?: string }).requestId === id)).toBe(true);
    expect(first.some((e) => e.id === old)).toBe(false);
    expect((await admin.from("email_outbox").select("status").eq("id", old ?? 0).single()).data?.status).toBe("skipped");
    // Claimed rows aren't handed out twice while being sent.
    const second = (await admin.rpc("claim_email_outbox", { p_limit: 50 })).data ?? [];
    expect(second.some((e) => (e.data as { requestId?: string }).requestId === id)).toBe(false);
  });
});
