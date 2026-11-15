import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../packages/platform/src/database";
import { NEAT, NED, OLIVIA, PAWS, adminClient, anonClient, newUser, signedIn } from "./helpers";

/**
 * Transformation R3: customer accounts, owner pets, marketplace listings and
 * booking requests. Requests stay requests until the front desk confirms a
 * time the database accepts; customers only ever see their own records.
 * Seed: Paws Test Salon works Mon–Sat 08:00–17:00 (Melbourne), owner Olivia.
 */
type Db = SupabaseClient<Database>;
const admin = adminClient();
const TZ = "Australia/Melbourne";
const created: string[] = [];
let olivia: Db;
let ned: Db;
let sarah: Db;
let sarahUser: { id: string; email: string };
let other: Db;
let groomer: Db;
let groomerUser: { id: string };
let ownerMember = "";
let serviceId = "";
let nailId = "";
let mochi = "";

function melbourne(days: number, hhmm: string): string {
  const base = new Date(Date.now() + days * 86_400_000);
  let date = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(base);
  if (new Date(`${date}T12:00:00Z`).getUTCDay() === 0) date = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(base.getTime() + 86_400_000));
  const guess = Date.parse(`${date}T${hhmm}:00Z`);
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(guess)).map((p) => [p.type, p.value]));
  return new Date(guess - (Date.parse(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:00Z`) - guess)).toISOString();
}
const localDay = (days: number) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(Date.now() + days * 86_400_000));

async function submit(db: Db, over: Partial<{ p_slug: string; p_owner_pet: string; p_service_ids: string[]; p_preferred_start: string | null; p_windows: unknown; p_notes: string }> = {}) {
  return db.rpc("submit_booking_request", { p_slug: "paws-test", p_owner_pet: mochi, p_service_ids: [serviceId], p_preferred_start: melbourne(8, "10:00"), p_windows: [], p_notes: "Nervous with dryers", ...over } as never);
}

beforeAll(async () => {
  olivia = await signedIn(OLIVIA);
  ned = await signedIn(NED);
  ownerMember = (await admin.from("business_members").select("id").eq("business_id", PAWS).eq("user_id", OLIVIA.id).single()).data?.id ?? "";
  serviceId = (await admin.from("services").insert({ business_id: PAWS, name: "R3 Full groom", duration_minutes: 60, buffer_minutes: 15, base_price_cents: 9000, bookable_online: true }).select("id").single()).data?.id ?? "";
  nailId = (await admin.from("services").insert({ business_id: PAWS, name: "R3 Nails", duration_minutes: 15, base_price_cents: 2500, bookable_online: true }).select("id").single()).data?.id ?? "";
  await admin.from("service_price_rules").insert({ business_id: PAWS, service_id: serviceId, kind: "size", match_value: "small", price_cents: 8000 });
  await admin.from("marketplace_profiles").upsert({ business_id: PAWS, listed: true, headline: "Gentle grooming in Melbourne" });
  sarahUser = await newUser("r3-sarah");
  created.push(sarahUser.id);
  sarah = await signedIn({ email: sarahUser.email, password: "a-strong-passphrase-42" });
  const o = await newUser("r3-other");
  created.push(o.id);
  other = await signedIn({ email: o.email, password: "a-strong-passphrase-42" });
  const g = await newUser("r3-groomer");
  created.push(g.id);
  groomerUser = g;
  await admin.from("business_members").insert({ business_id: PAWS, user_id: g.id, role: "groomer", display_name: "Gus" });
  groomer = await signedIn({ email: g.email, password: "a-strong-passphrase-42" });
  mochi = (await sarah.from("owner_pets").insert({ user_id: sarahUser.id, name: "Mochi", species: "cat", breed: "Persian", size: "small", care_notes: "Hates the dryer on high" }).select("id").single()).data?.id ?? "";
});

afterAll(async () => {
  await admin.from("booking_requests").delete().eq("business_id", PAWS);
  await admin.from("appointments").delete().eq("business_id", PAWS).eq("source", "online").like("customer_notes", "R3%");
  await admin.from("marketplace_profiles").delete().eq("business_id", PAWS);
  await admin.from("business_members").delete().eq("user_id", groomerUser.id);
  for (const id of created) await admin.auth.admin.deleteUser(id);
});

describe("owner pets", () => {
  it("are private to their owner", async () => {
    expect((await sarah.from("owner_pets").select("name")).data).toEqual([{ name: "Mochi" }]);
    expect((await other.from("owner_pets").select("name")).data).toEqual([]);
    expect((await olivia.from("owner_pets").select("name")).data).toEqual([]);
    expect((await other.from("owner_pets").insert({ user_id: sarahUser.id, name: "Imposter" })).error).not.toBeNull();
    expect((await other.from("owner_pets").update({ name: "Hacked" }).eq("id", mochi).select("id")).data).toEqual([]);
  });
});

describe("marketplace", () => {
  it("shows listed businesses with bookable services and no customer data, to anyone", async () => {
    const list = (await anonClient().rpc("marketplace_listings")).data as Array<{ slug: string }>;
    expect(list.map((b) => b.slug)).toContain("paws-test");
    expect(list.map((b) => b.slug)).not.toContain("neat-coat-test");
    const one = (await anonClient().rpc("marketplace_listing", { p_slug: "paws-test" })).data as { services: Array<{ name: string; sizePrices: Record<string, number> }> };
    expect(one.services.find((s) => s.name === "R3 Full groom")?.sizePrices).toEqual({ small: 8000 });
    expect(JSON.stringify(one)).not.toMatch(/@example\.test/);
    expect((await anonClient().rpc("marketplace_listing", { p_slug: "neat-coat-test" })).data).toBeNull();
  });

  it("only owners and managers edit the listing", async () => {
    expect((await groomer.from("marketplace_profiles").update({ headline: "Nope" }).eq("business_id", PAWS).select("business_id")).data).toEqual([]);
    expect((await ned.from("marketplace_profiles").update({ headline: "Nope" }).eq("business_id", PAWS).select("business_id")).data).toEqual([]);
    expect((await olivia.from("marketplace_profiles").update({ headline: "Gentle grooming in Melbourne" }).eq("business_id", PAWS).select("business_id")).data).toHaveLength(1);
  });
});

describe("booking requests", () => {
  let requestId = "";

  it("creates a request, a linked customer and a linked pet with the owner's notes and a size price", async () => {
    const r = await submit(sarah, { p_notes: "R3 Nervous with dryers", p_service_ids: [serviceId, nailId] });
    expect(r.error).toBeNull();
    requestId = r.data as unknown as string;
    const req = (await olivia.from("booking_requests").select("status, estimate_cents, estimate_minutes, block_minutes, customer_id, pet_id").eq("id", requestId).single()).data;
    expect(req).toMatchObject({ status: "awaiting_review", estimate_cents: 10500, estimate_minutes: 75, block_minutes: 90 });
    const cust = (await admin.from("customers").select("account_user_id, first_name").eq("id", req?.customer_id ?? "").single()).data;
    expect(cust?.account_user_id).toBe(sarahUser.id);
    const pet = (await olivia.from("pets").select("name, owner_pet_id, owner_notes").eq("id", req?.pet_id ?? "").single()).data;
    expect(pet).toMatchObject({ name: "Mochi", owner_pet_id: mochi });
    expect(pet?.owner_notes).toContain("Hates the dryer on high");
    expect((await sarah.from("booking_request_events").select("to_status").eq("request_id", requestId)).data?.map((e) => e.to_status)).toEqual(["submitted", "awaiting_review"]);
  });

  it("keeps requests inside their business and away from other customers", async () => {
    expect((await ned.from("booking_requests").select("id").eq("id", requestId)).data).toEqual([]);
    expect((await other.from("booking_requests").select("id").eq("id", requestId)).data).toEqual([]);
    expect((await other.from("booking_request_services").select("id").eq("request_id", requestId)).data).toEqual([]);
    expect((await sarah.from("booking_requests").update({ status: "confirmed" }).eq("id", requestId).select("id")).error).not.toBeNull();
    expect(((await other.rpc("my_bookings")).data as { requests: unknown[] }).requests).toEqual([]);
    expect(((await sarah.rpc("my_bookings")).data as { requests: Array<{ petName: string }> }).requests[0]?.petName).toBe("Mochi");
  });

  it("flows owner edits to the business pet; staff can't change the link or the owner's notes", async () => {
    await sarah.from("owner_pets").update({ breed: "Persian (silver)", grooming_preferences: "Teddy face" }).eq("id", mochi);
    const pet = (await olivia.from("pets").select("id, breed, owner_notes").eq("owner_pet_id", mochi).single()).data;
    expect(pet?.breed).toBe("Persian (silver)");
    expect(pet?.owner_notes).toContain("Teddy face");
    expect((await olivia.from("pets").update({ owner_notes: "edited" }).eq("id", pet?.id ?? "")).error).not.toBeNull();
    expect((await olivia.from("customers").update({ account_user_id: OLIVIA.id }).eq("business_id", PAWS)).error).not.toBeNull();
  });

  it("refuses bad input: unlisted business, someone else's pet, unknown services, past times, bad windows", async () => {
    expect((await submit(sarah, { p_slug: "neat-coat-test" })).error?.message).toBe("not_found");
    expect((await submit(other)).error?.message).toBe("invalid_pet");
    expect((await submit(sarah, { p_service_ids: [crypto.randomUUID()] })).error?.message).toBe("invalid_services");
    expect((await submit(sarah, { p_preferred_start: new Date(Date.now() - 3_600_000).toISOString() })).error?.message).toBe("invalid_time");
    expect((await submit(sarah, { p_preferred_start: null, p_windows: [{ date: localDay(3), part: "midnight" }] })).error?.message).toBe("invalid_time");
    expect((await submit(sarah, { p_preferred_start: null, p_windows: [] })).error?.message).toBe("invalid_time");
  });

  it("lets only the front desk confirm, checks hours and clashes, and never confirms twice", async () => {
    expect((await groomer.rpc("review_booking_request", { p_id: requestId, p_action: "confirm", p_groomer: ownerMember, p_starts_at: melbourne(8, "10:00"), p_reason: "" } as never)).error?.message).toBe("not_found");
    expect((await ned.rpc("review_booking_request", { p_id: requestId, p_action: "confirm", p_groomer: ownerMember, p_starts_at: melbourne(8, "10:00"), p_reason: "" } as never)).error?.message).toBe("not_found");
    expect((await olivia.rpc("review_booking_request", { p_id: requestId, p_action: "confirm", p_groomer: ownerMember, p_starts_at: melbourne(8, "19:00"), p_reason: "" } as never)).error?.message).toBe("outside_hours");
    // Another appointment in the way.
    const blocker = (await admin.from("booking_requests").select("customer_id, pet_id, location_id").eq("id", requestId).single()).data;
    const clash = (await admin.from("appointments").insert({ business_id: PAWS, location_id: blocker?.location_id ?? "", customer_id: blocker?.customer_id ?? "", pet_id: blocker?.pet_id ?? "", groomer_id: ownerMember, starts_at: melbourne(8, "10:30"), service_ends_at: melbourne(8, "11:00"), ends_at: melbourne(8, "11:00"), source: "online", customer_notes: "R3 blocker" }).select("id").single()).data;
    expect((await olivia.rpc("review_booking_request", { p_id: requestId, p_action: "confirm", p_groomer: ownerMember, p_starts_at: melbourne(8, "10:00"), p_reason: "" } as never)).error?.message).toBe("slot_unavailable");
    await admin.from("appointments").delete().eq("id", clash?.id ?? "");
    const ok = await olivia.rpc("review_booking_request", { p_id: requestId, p_action: "confirm", p_groomer: ownerMember, p_starts_at: melbourne(8, "10:00"), p_reason: "" } as never);
    expect(ok.error).toBeNull();
    const appt = (await olivia.from("appointments").select("status, price_estimate_cents, customer_notes").eq("id", ok.data as unknown as string).single()).data;
    expect(appt).toMatchObject({ status: "confirmed", price_estimate_cents: 10500 });
    expect((await olivia.rpc("review_booking_request", { p_id: requestId, p_action: "reject", p_groomer: null, p_starts_at: null, p_reason: "late" } as never)).error?.message).toBe("no_longer_available");
    const mine = (await sarah.rpc("my_bookings")).data as { appointments: Array<{ petName: string; groomerName: string }> };
    expect(mine.appointments.find((a) => a.petName === "Mochi")?.groomerName).toBe("Olivia Test");
  });

  it("shows the salon's progress on the request", async () => {
    const appt = (await admin.from("booking_requests").select("appointment_id").eq("id", requestId).single()).data?.appointment_id ?? "";
    await olivia.rpc("set_appointment_status", { p_id: appt, p_status: "checked_in" });
    expect((await sarah.from("booking_requests").select("status").eq("id", requestId).single()).data?.status).toBe("in_progress");
    await olivia.rpc("set_appointment_status", { p_id: appt, p_status: "completed" });
    expect((await sarah.from("booking_requests").select("status").eq("id", requestId).single()).data?.status).toBe("completed");
    expect((await sarah.rpc("cancel_booking_request", { p_id: requestId, p_reason: "" })).error?.message).toBe("too_late");
  });

  it("lets the customer cancel, rejects with a reason and limits open requests", async () => {
    const a = (await submit(sarah, { p_preferred_start: null, p_windows: [{ date: localDay(5), part: "morning" }] })).data as unknown as string;
    expect((await sarah.rpc("cancel_booking_request", { p_id: a, p_reason: "Plans changed" })).error).toBeNull();
    expect((await other.rpc("cancel_booking_request", { p_id: a, p_reason: "" })).error?.message).toBe("not_found");
    const b = (await submit(sarah)).data as unknown as string;
    await olivia.rpc("review_booking_request", { p_id: b, p_action: "reject", p_groomer: null, p_starts_at: null, p_reason: "Fully booked that week" } as never);
    expect((await sarah.from("booking_requests").select("status, decision_reason").eq("id", b).single()).data).toEqual({ status: "rejected", decision_reason: "Fully booked that week" });
    for (let i = 0; i < 3; i++) expect((await submit(sarah, { p_preferred_start: melbourne(10 + i, "09:00") })).error).toBeNull();
    expect((await submit(sarah, { p_preferred_start: melbourne(14, "09:00") })).error?.message).toBe("rate_limited");
  });

  it("links an existing customer record by verified email instead of creating a second one", async () => {
    const u = await newUser("r3-existing");
    created.push(u.id);
    const existing = (await admin.from("customers").insert({ business_id: PAWS, first_name: "Existing", last_name: "Customer" }).select("id").single()).data?.id ?? "";
    await admin.from("customer_contacts").insert({ customer_id: existing, business_id: PAWS, email: u.email });
    const db = await signedIn({ email: u.email, password: "a-strong-passphrase-42" });
    expect((await db.rpc("claim_customer_records")).data).toBe(1);
    expect((await admin.from("customers").select("account_user_id").eq("id", existing).single()).data?.account_user_id).toBe(u.id);
    expect((await db.rpc("claim_customer_records")).data).toBe(0);
    await admin.from("customers").update({ archived_at: new Date().toISOString() }).eq("id", existing);
  });
});

void NEAT;
