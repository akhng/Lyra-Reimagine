import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../packages/platform/src/database";
import { NEAT, NED, OLIVIA, PAWS, adminClient, anonClient, newUser, signedIn } from "./helpers";

/**
 * Phase 3: appointments never overlap for a groomer (database constraint),
 * stay inside their business, follow role rules, and the public booking
 * functions expose no customer data and re-check every booking.
 * Seed: Paws Test Salon's main location and its owner (Olivia) work Mon–Sat 08:00–17:00 Melbourne time.
 */
const admin = adminClient();
const TZ = "Australia/Melbourne";
let olivia: SupabaseClient<Database>;
let ned: SupabaseClient<Database>;
let groomer: SupabaseClient<Database>;
let groomerUser: { id: string };
let ownerMember = "";
let groomerMember = "";
let locationId = "";
let customerId = "";
let otherCustomerId = "";
let petId = "";
let otherPetId = "";
let serviceId = "";

/** UTC ISO for a local wall-clock time in Melbourne `days` from now (moved to the next Mon–Sat). */
function melbourne(days: number, hhmm: string): string {
  const base = new Date(Date.now() + days * 86_400_000);
  let date = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(base);
  if (new Date(`${date}T12:00:00Z`).getUTCDay() === 0) date = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(base.getTime() + 86_400_000));
  const guess = Date.parse(`${date}T${hhmm}:00Z`);
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(guess)).map((p) => [p.type, p.value]));
  const asLocal = Date.parse(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:00Z`);
  return new Date(guess - (asLocal - guess)).toISOString();
}
const plus = (iso: string, minutes: number) => new Date(Date.parse(iso) + minutes * 60_000).toISOString();

function appt(starts: string, minutes: number, extra: Partial<Database["public"]["Tables"]["appointments"]["Insert"]> = {}) {
  return { business_id: PAWS, location_id: locationId, customer_id: customerId, pet_id: petId, groomer_id: ownerMember, starts_at: starts, service_ends_at: plus(starts, minutes), ends_at: plus(starts, minutes), ...extra };
}

beforeAll(async () => {
  olivia = await signedIn(OLIVIA);
  ned = await signedIn(NED);
  ownerMember = (await admin.from("business_members").select("id").eq("business_id", PAWS).eq("user_id", OLIVIA.id).single()).data?.id ?? "";
  locationId = (await admin.from("locations").select("id").eq("business_id", PAWS).eq("is_mobile", false).limit(1).single()).data?.id ?? "";
  const g = await newUser("p3-groomer");
  groomerUser = g;
  groomerMember = (await admin.from("business_members").insert({ business_id: PAWS, user_id: g.id, role: "groomer", display_name: "Gus Groomer" }).select("id").single()).data?.id ?? "";
  groomer = await signedIn(g);
  const c = await admin.from("customers").insert([{ business_id: PAWS, first_name: "Sched", last_name: "Tester" }, { business_id: PAWS, first_name: "Other", last_name: "Owner" }]).select("id, first_name");
  customerId = c.data?.find((x) => x.first_name === "Sched")?.id ?? "";
  otherCustomerId = c.data?.find((x) => x.first_name === "Other")?.id ?? "";
  await admin.from("customer_contacts").insert({ customer_id: customerId, business_id: PAWS, email: "sched@example.test", mobile: "0400 000 001" });
  petId = (await admin.from("pets").insert({ business_id: PAWS, customer_id: customerId, name: "Biscuit", size: "small" }).select("id").single()).data?.id ?? "";
  otherPetId = (await admin.from("pets").insert({ business_id: PAWS, customer_id: otherCustomerId, name: "Rex" }).select("id").single()).data?.id ?? "";
  serviceId = (await admin.from("services").insert({ business_id: PAWS, name: "Wash & tidy", duration_minutes: 60, buffer_minutes: 15, base_price_cents: 6000, bookable_online: true }).select("id").single()).data?.id ?? "";
  await admin.from("service_price_rules").insert({ business_id: PAWS, service_id: serviceId, kind: "size", match_value: "large", price_cents: 9000 });
});

afterAll(async () => {
  await admin.from("appointment_services").delete().eq("business_id", PAWS);
  await admin.from("appointments").delete().eq("business_id", PAWS);
  await admin.from("waitlist_entries").delete().eq("business_id", PAWS);
  await admin.from("booking_attempts").delete().eq("business_id", PAWS);
  await admin.from("pets").delete().eq("business_id", PAWS);
  await admin.from("customers").delete().eq("business_id", PAWS);
  await admin.from("services").delete().eq("business_id", PAWS);
  await admin.from("booking_policies").update({ online_enabled: true }).eq("business_id", PAWS);
  await admin.auth.admin.deleteUser(groomerUser.id);
});

describe("no double-booking", () => {
  it("refuses an overlapping appointment for the same groomer, allows back-to-back and other groomers, and frees cancelled slots", async () => {
    const t = melbourne(3, "10:00");
    expect((await olivia.from("appointments").insert(appt(t, 60)).select("id").single()).error).toBeNull();
    const clash = await olivia.from("appointments").insert(appt(plus(t, 30), 60));
    expect(clash.error?.code).toBe("23P01");
    expect((await olivia.from("appointments").insert(appt(plus(t, 60), 30)).select("id").single()).error).toBeNull();
    expect((await olivia.from("appointments").insert(appt(plus(t, 30), 60, { groomer_id: groomerMember })).select("id").single()).error).toBeNull();
    const { data: c } = await olivia.from("appointments").insert(appt(plus(t, 180), 60)).select("id").single();
    expect((await olivia.rpc("set_appointment_status", { p_id: c?.id ?? "", p_status: "cancelled", p_reason: "Owner sick" })).error).toBeNull();
    expect((await olivia.from("appointments").insert(appt(plus(t, 180), 60)).select("id").single()).error).toBeNull();
  });

  it("lets only one of two simultaneous bookings for the same slot through", async () => {
    // Clear of the previous test's 10:00–14:00 bookings: when day 3 is a Sunday, melbourne() moves it onto day 4.
    const t = melbourne(4, "15:30");
    const [a, b] = await Promise.all([olivia.from("appointments").insert(appt(t, 60)).select("id"), olivia.from("appointments").insert(appt(t, 60)).select("id")]);
    expect([a.error, b.error].filter((e) => e === null)).toHaveLength(1);
    expect([a.error?.code, b.error?.code]).toContain("23P01");
  });

  it("counts the clean-up buffer as busy time", async () => {
    const t = melbourne(5, "09:00");
    expect((await olivia.from("appointments").insert(appt(t, 60, { ends_at: plus(t, 75) })).select("id").single()).error).toBeNull();
    expect((await olivia.from("appointments").insert(appt(plus(t, 70), 30))).error?.code).toBe("23P01");
  });
});

describe("tenancy and roles", () => {
  it("keeps appointments inside their business", async () => {
    expect((await ned.from("appointments").select("id").eq("business_id", PAWS)).data).toEqual([]);
    const nedLocation = (await admin.from("locations").select("id").eq("business_id", NEAT).limit(1).single()).data?.id ?? "";
    const nedMember = (await admin.from("business_members").select("id").eq("business_id", NEAT).limit(1).single()).data?.id ?? "";
    // Ned can't book into Paws, nor point his appointment at Paws' customer and pet.
    expect((await ned.from("appointments").insert(appt(melbourne(6, "10:00"), 30))).error).not.toBeNull();
    expect((await ned.from("appointments").insert({ ...appt(melbourne(6, "10:00"), 30), business_id: NEAT, location_id: nedLocation, groomer_id: nedMember })).error).not.toBeNull();
  });
  it("refuses a pet that belongs to another customer", async () => {
    expect((await olivia.from("appointments").insert(appt(melbourne(6, "12:00"), 30, { pet_id: otherPetId }))).error?.code).toBe("23503");
  });
  it("lets groomers read and move their own appointments through the day, but not book, cancel or touch others'", async () => {
    const t = melbourne(7, "10:00");
    const mine = (await olivia.from("appointments").insert(appt(t, 60, { groomer_id: groomerMember })).select("id").single()).data?.id ?? "";
    const theirs = (await olivia.from("appointments").insert(appt(t, 60)).select("id").single()).data?.id ?? "";
    expect((await groomer.from("appointments").select("id").eq("id", mine)).data).toHaveLength(1);
    expect((await groomer.from("appointments").insert(appt(melbourne(7, "14:00"), 30, { groomer_id: groomerMember }))).error).not.toBeNull();
    expect((await groomer.rpc("set_appointment_status", { p_id: mine, p_status: "checked_in" })).error).toBeNull();
    expect((await groomer.rpc("set_appointment_status", { p_id: mine, p_status: "cancelled" })).error?.code).toBe("42501");
    expect((await groomer.rpc("set_appointment_status", { p_id: theirs, p_status: "checked_in" })).error?.code).toBe("42501");
    expect((await groomer.from("appointments").update({ notes: "x" }).eq("id", mine).select()).data ?? []).toEqual([]);
  });
  it("never shows the manage token hash to staff, and nobody deletes appointments", async () => {
    expect((await olivia.from("appointments").select("manage_token_hash").limit(1)).error).not.toBeNull();
    const id = (await admin.from("appointments").select("id").eq("business_id", PAWS).limit(1).single()).data?.id ?? "";
    await olivia.from("appointments").delete().eq("id", id);
    expect((await admin.from("appointments").select("id").eq("id", id)).data).toHaveLength(1);
  });
  it("limits hours and booking policy changes to owners and managers", async () => {
    expect((await groomer.from("booking_policies").update({ online_enabled: false }).eq("business_id", PAWS).select()).data ?? []).toEqual([]);
    expect((await groomer.from("staff_hours").insert({ business_id: PAWS, member_id: groomerMember, location_id: locationId, weekday: 7, starts: "09:00", ends: "12:00" })).error).not.toBeNull();
    expect((await olivia.from("staff_hours").insert({ business_id: PAWS, member_id: groomerMember, location_id: locationId, weekday: 1, starts: "09:00", ends: "17:00" })).error).toBeNull();
    expect((await ned.from("location_hours").select("id").eq("business_id", PAWS)).data).toEqual([]);
  });
  it("keeps the waitlist inside the business", async () => {
    expect((await olivia.from("waitlist_entries").insert({ business_id: PAWS, customer_id: customerId, pet_id: petId, earliest_on: "2026-12-01", latest_on: "2026-12-10" })).error).toBeNull();
    expect((await ned.from("waitlist_entries").select("id").eq("business_id", PAWS)).data).toEqual([]);
    expect((await olivia.from("waitlist_entries").insert({ business_id: PAWS, customer_id: customerId, pet_id: otherPetId, earliest_on: "2026-12-01", latest_on: "2026-12-10" })).error).not.toBeNull();
  });
});

describe("public booking functions", () => {
  const anon = anonClient();
  const customer = { firstName: "Casey", lastName: "Online", email: "casey@example.test", mobile: "0412 555 111" };
  const book = (starts: string, extra: Record<string, unknown> = {}) =>
    anon.rpc("create_online_booking", { p_slug: "paws-test", p_location: locationId, p_groomer: null, p_service_ids: [serviceId], p_starts_at: starts, p_customer: customer, p_pet: { name: "Pip", species: "dog", size: "large" }, p_notes: "First visit", p_client_hash: "abcdef0123456789", ...extra } as never);

  it("anonymous visitors can't read any table", async () => {
    for (const t of ["appointments", "customers", "customer_contacts", "pets", "staff_hours", "booking_policies", "services"] as const) expect((await anon.from(t).select("*").limit(1)).data ?? [], t).toEqual([]);
  });

  it("shows what booking needs and no customer data", async () => {
    const from = new Date().toISOString().slice(0, 10);
    const to = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);
    const { data, error } = await anon.rpc("booking_context", { p_slug: "paws-test", p_from: from, p_to: to });
    expect(error).toBeNull();
    const ctx = data as { online: boolean; services: Array<{ name: string }>; groomers: Array<{ name: string }>; busy: unknown[] };
    expect(ctx.online).toBe(true);
    expect(ctx.services.map((s) => s.name)).toContain("Wash & tidy");
    expect(ctx.groomers.map((g) => g.name)).toContain("Gus");
    expect(JSON.stringify(data)).not.toMatch(/Sched|Tester|sched@example|Biscuit/);
    expect((await anon.rpc("booking_context", { p_slug: "no-such-salon", p_from: from, p_to: to })).data).toBeNull();
  });

  it("books a free slot inside hours, prices it for the pet, and returns a manage token once", async () => {
    const { data, error } = await book(melbourne(9, "13:00"));
    expect(error).toBeNull();
    const r = data as { appointmentId: string; token: string; priceCents: number };
    expect(r.token).toMatch(/^[0-9a-f]{48}$/);
    expect(r.priceCents).toBe(9000);
    const row = (await admin.from("appointments").select("source, status, ends_at, service_ends_at, manage_token_hash, customer_id").eq("id", r.appointmentId).single()).data;
    expect(row?.source).toBe("online");
    expect(Date.parse(row?.ends_at ?? "") - Date.parse(row?.service_ends_at ?? "")).toBe(15 * 60_000);
    expect(row?.manage_token_hash).not.toContain(r.token);
    // The token reads the booking; a wrong one reads nothing.
    const view = (await anon.rpc("get_booking_by_token", { p_token: r.token })).data as { pet: string; changeable: boolean };
    expect(view.pet).toBe("Pip");
    expect(view.changeable).toBe(true);
    expect((await anon.rpc("get_booking_by_token", { p_token: "0".repeat(48) })).data).toBeNull();
    // Reschedule, then cancel.
    expect((await anon.rpc("reschedule_booking_by_token", { p_token: r.token, p_starts_at: melbourne(9, "15:00") })).error).toBeNull();
    expect((await anon.rpc("cancel_booking_by_token", { p_token: r.token })).error).toBeNull();
    expect((await admin.from("appointments").select("status, cancelled_by").eq("id", r.appointmentId).single()).data).toEqual({ status: "cancelled", cancelled_by: "customer" });
  });

  it("re-checks hours, notice and overlap on the server", async () => {
    expect((await book(melbourne(10, "06:00"))).error?.message).toBe("slot_unavailable");
    expect((await book(melbourne(10, "16:30"))).error?.message).toBe("slot_unavailable");
    expect((await book(new Date(Date.now() + 10 * 60_000).toISOString())).error?.message).toBe("outside_window");
    const t = melbourne(11, "09:00");
    // Both groomers busy at 09:00 → no one left.
    await olivia.from("appointments").insert([appt(t, 120), appt(t, 120, { groomer_id: groomerMember })]);
    expect((await book(t, { p_customer: { ...customer, email: "other@example.test" } })).error?.message).toBe("slot_unavailable");
  });

  it("refuses services that aren't bookable online, and bad details", async () => {
    const hidden = (await admin.from("services").insert({ business_id: PAWS, name: "Staff only", duration_minutes: 30, base_price_cents: 1000, bookable_online: false }).select("id").single()).data?.id ?? "";
    expect((await book(melbourne(12, "10:00"), { p_service_ids: [hidden] })).error?.message).toBe("invalid_services");
    expect((await book(melbourne(12, "10:00"), { p_customer: { ...customer, email: "not-an-email" } })).error?.message).toBe("invalid_email");
  });

  it("reuses a customer only when both email and mobile match", async () => {
    const { data } = await book(melbourne(13, "10:00"), { p_customer: { firstName: "Sched", email: "SCHED@example.test", mobile: "0400000001" }, p_pet: { name: "biscuit" } });
    const id = (data as { appointmentId: string }).appointmentId;
    expect((await admin.from("appointments").select("customer_id, pet_id").eq("id", id).single()).data).toEqual({ customer_id: customerId, pet_id: petId });
  });

  it("rate-limits repeated bookings from the same email", async () => {
    const spam = { ...customer, email: "spam@example.test" };
    // One booking every other day so a date moved off a Sunday never meets the next one, and back-to-back services never overlap.
    const results = [];
    for (let i = 0; i < 6; i++) results.push((await book(melbourne(20 + 2 * i, "10:00"), { p_customer: spam, p_client_hash: null })).error?.message ?? "ok");
    expect(results.slice(0, 5)).toEqual(["ok", "ok", "ok", "ok", "ok"]);
    expect(results[5]).toBe("rate_limited");
  });

  it("refuses everything when online booking is off", async () => {
    await admin.from("booking_policies").update({ online_enabled: false }).eq("business_id", PAWS);
    const from = new Date().toISOString().slice(0, 10);
    expect(((await anon.rpc("booking_context", { p_slug: "paws-test", p_from: from, p_to: from })).data as { online: boolean }).online).toBe(false);
    expect((await book(melbourne(15, "10:00"), { p_customer: { ...customer, email: "off@example.test" } })).error?.message).toBe("online_off");
    await admin.from("booking_policies").update({ online_enabled: true }).eq("business_id", PAWS);
  });
});
