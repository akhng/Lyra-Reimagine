import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../packages/platform/src/database";
import { NED, OLIVIA, PAWS, adminClient, newUser, signedIn } from "./helpers";

/**
 * Transformation R5: points only on completion and never twice, reversals,
 * redemption limits, birthdays, achievements once, reviews by the right
 * customer, and privacy across businesses and customers.
 */
type Db = SupabaseClient<Database>;
const admin = adminClient();
const created: string[] = [];
let olivia: Db;
let ned: Db;
let owner: Db;
let ownerUser: { id: string };
let other: Db;
let groomer: Db;
let groomerUser: { id: string };
let customerId = "";
let petId = "";
let ownerMember = "";
let locationId = "";
const appts: string[] = [];

async function completedAppointment(daysAgo: number, cents = 8000): Promise<string> {
  const start = new Date(Date.now() - daysAgo * 86_400_000);
  start.setUTCHours(0, 0, 0, 0);
  const id = (await admin.from("appointments").insert({ business_id: PAWS, location_id: locationId, customer_id: customerId, pet_id: petId, groomer_id: ownerMember, starts_at: start.toISOString(), service_ends_at: new Date(start.getTime() + 3_600_000).toISOString(), ends_at: new Date(start.getTime() + 3_600_000).toISOString(), status: "confirmed", price_estimate_cents: cents, customer_notes: "R5 test" }).select("id").single()).data?.id ?? "";
  appts.push(id);
  return id;
}
const complete = (id: string) => olivia.rpc("set_appointment_status", { p_id: id, p_status: "completed" });
const balance = async () => ((await admin.from("points_ledger").select("delta").eq("customer_id", customerId)).data ?? []).reduce((s, r) => s + r.delta, 0);

beforeAll(async () => {
  olivia = await signedIn(OLIVIA);
  ned = await signedIn(NED);
  ownerMember = (await admin.from("business_members").select("id").eq("business_id", PAWS).eq("user_id", OLIVIA.id).single()).data?.id ?? "";
  locationId = (await admin.from("locations").select("id").eq("business_id", PAWS).order("created_at").limit(1).single()).data?.id ?? "";
  const u = await newUser("r5-owner");
  created.push(u.id);
  ownerUser = u;
  owner = await signedIn({ email: u.email, password: "a-strong-passphrase-42" });
  const o = await newUser("r5-other");
  created.push(o.id);
  other = await signedIn({ email: o.email, password: "a-strong-passphrase-42" });
  const g = await newUser("r5-groomer");
  created.push(g.id);
  groomerUser = g;
  await admin.from("business_members").insert({ business_id: PAWS, user_id: g.id, role: "groomer" });
  groomer = await signedIn({ email: g.email, password: "a-strong-passphrase-42" });
  customerId = (await admin.from("customers").insert({ business_id: PAWS, first_name: "Loyal", last_name: "Customer", account_user_id: u.id }).select("id").single()).data?.id ?? "";
  const birthday = new Date(Date.now() - 5 * 86_400_000);
  const dob = `${birthday.getUTCFullYear() - 3}-${String(birthday.getUTCMonth() + 1).padStart(2, "0")}-${String(Math.min(birthday.getUTCDate(), 28)).padStart(2, "0")}`;
  petId = (await admin.from("pets").insert({ business_id: PAWS, customer_id: customerId, name: "Pepper", date_of_birth: dob }).select("id").single()).data?.id ?? "";
  await admin.from("loyalty_settings").upsert({ business_id: PAWS, points_per_appointment: 10, points_per_dollar: 1, birthday_points: 50 });
});

afterAll(async () => {
  await admin.from("appointments").delete().in("id", appts);
  await admin.from("customers").delete().eq("id", customerId);
  await admin.from("loyalty_rewards").delete().eq("business_id", PAWS);
  await admin.from("loyalty_settings").delete().eq("business_id", PAWS);
  await admin.from("achievement_awards").delete().eq("business_id", PAWS);
  await admin.from("business_members").delete().eq("user_id", groomerUser.id);
  for (const id of created) await admin.auth.admin.deleteUser(id);
});

describe("points", () => {
  it("pays only when an appointment is completed, once, and reverses if it's undone", async () => {
    const a = await completedAppointment(20);
    expect(await balance()).toBe(0);
    await complete(a);
    expect(await balance()).toBe(90); // 10 per visit + $80 × 1
    await olivia.rpc("set_appointment_status", { p_id: a, p_status: "checked_in" });
    expect(await balance()).toBe(0);
    await complete(a);
    expect(await balance()).toBe(0); // the original source key already paid: no double reward
    const kinds = ((await admin.from("notifications").select("kind").eq("user_id", ownerUser.id)).data ?? []).map((n) => n.kind);
    expect(kinds).toContain("points_earned");
  });

  it("respects the business's rules and switch", async () => {
    await admin.from("loyalty_settings").update({ enabled: false }).eq("business_id", PAWS);
    await complete(await completedAppointment(19));
    expect(await balance()).toBe(0);
    await admin.from("loyalty_settings").update({ enabled: true, points_per_appointment: 20, points_per_dollar: 0 }).eq("business_id", PAWS);
    await complete(await completedAppointment(18));
    expect(await balance()).toBe(20);
    await admin.from("loyalty_settings").update({ points_per_appointment: 10, points_per_dollar: 1 }).eq("business_id", PAWS);
  });

  it("lets the front desk redeem rewards only with enough points", async () => {
    const reward = (await olivia.from("loyalty_rewards").insert({ business_id: PAWS, name: "Free nail trim", cost_points: 15 }).select("id").single()).data?.id ?? "";
    const big = (await olivia.from("loyalty_rewards").insert({ business_id: PAWS, name: "Free full groom", cost_points: 500 }).select("id").single()).data?.id ?? "";
    expect((await groomer.rpc("redeem_reward", { p_customer: customerId, p_reward: reward })).error?.message).toBe("not_found");
    expect((await ned.rpc("redeem_reward", { p_customer: customerId, p_reward: reward })).error?.message).toBe("not_found");
    expect((await olivia.rpc("redeem_reward", { p_customer: customerId, p_reward: big })).error?.message).toBe("not_enough_points");
    expect((await olivia.rpc("redeem_reward", { p_customer: customerId, p_reward: reward })).data).toBe(5);
    expect((await olivia.rpc("redeem_reward", { p_customer: customerId, p_reward: reward })).error?.message).toBe("not_enough_points");
    expect(await balance()).toBe(5);
  });

  it("awards pet birthday points once a year", async () => {
    expect((await owner.rpc("claim_birthday_rewards")).data).toBe(1);
    expect((await owner.rpc("claim_birthday_rewards")).data).toBe(0);
    expect(await balance()).toBe(55);
  });

  it("keeps the ledger private and read-only", async () => {
    expect((await groomer.from("points_ledger").select("id").eq("customer_id", customerId)).data).toEqual([]);
    expect((await ned.from("points_ledger").select("id").eq("customer_id", customerId)).data).toEqual([]);
    expect((await olivia.from("points_ledger").insert({ business_id: PAWS, customer_id: customerId, delta: 1000, reason: "adjustment", source_key: "hack" })).error).not.toBeNull();
    const mine = (await owner.rpc("my_loyalty")).data as { salons: Array<{ balance: number; lifetime: number; history: unknown[] }> };
    expect(mine.salons[0]).toMatchObject({ balance: 55 });
    expect(((await other.rpc("my_loyalty")).data as { salons: unknown[] }).salons).toEqual([]);
  });
});

describe("achievements", () => {
  it("awards a pet's grooming milestones once, with a notification", async () => {
    for (let i = 0; i < 3; i++) await complete(await completedAppointment(10 - i));
    const awards = ((await olivia.from("achievement_awards").select("key").eq("pet_id", petId)).data ?? []).map((a) => a.key);
    expect(awards).toEqual(expect.arrayContaining(["grooms_1", "grooms_5"]));
    expect(awards.filter((k) => k === "grooms_5")).toHaveLength(1);
    const n = ((await admin.from("notifications").select("data").eq("user_id", ownerUser.id).eq("kind", "achievement")).data ?? []).map((x) => (x.data as { key: string }).key);
    expect(n).toEqual(expect.arrayContaining(["grooms_1", "grooms_5"]));
    expect((await ned.from("achievement_awards").select("id").eq("business_id", PAWS)).data).toEqual([]);
  });
});

describe("reviews", () => {
  it("lets the customer review a completed appointment once; owners can reply", async () => {
    const done = appts[0] ?? "";
    const pending = await completedAppointment(-3);
    expect((await other.rpc("submit_review", { p_appointment: done, p_rating: 5, p_comment: "x" })).error?.message).toBe("not_found");
    expect((await owner.rpc("submit_review", { p_appointment: pending, p_rating: 5, p_comment: "x" })).error?.message).toBe("not_completed");
    expect((await owner.rpc("submit_review", { p_appointment: done, p_rating: 7, p_comment: "x" })).error?.message).toBe("invalid_review");
    const r = await owner.rpc("submit_review", { p_appointment: done, p_rating: 5, p_comment: "Pepper looks amazing" });
    expect(r.error).toBeNull();
    expect((await owner.rpc("submit_review", { p_appointment: done, p_rating: 4, p_comment: "again" })).error?.message).toBe("already_reviewed");
    expect((await groomer.rpc("reply_review", { p_review: r.data as unknown as string, p_reply: "Thanks!" })).error?.message).toBe("not_found");
    expect((await olivia.rpc("reply_review", { p_review: r.data as unknown as string, p_reply: "Thanks, see you soon!" })).error).toBeNull();
    expect((await olivia.from("reviews").select("rating, reply").eq("id", r.data as unknown as string).single()).data).toEqual({ rating: 5, reply: "Thanks, see you soon!" });
    expect((await ned.from("reviews").select("id").eq("business_id", PAWS)).data).toEqual([]);
    expect((await other.from("reviews").select("id")).data).toEqual([]);
    expect(((await admin.from("notifications").select("kind").eq("user_id", OLIVIA.id).eq("kind", "review_new")).data ?? []).length).toBeGreaterThan(0);
  });
});
