import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../packages/platform/src/database";
import { NED, OLIVIA, PAWS, adminClient, newUser, signedIn } from "./helpers";

/**
 * Transformation R4: allocation modes, the shift board, one-winner acceptance,
 * capability and hours checks, deadlines and expiry, and notifications.
 * Seed: Paws Test Salon (Melbourne), owner Olivia, open Mon–Sat 08:00–17:00.
 */
type Db = SupabaseClient<Database>;
const admin = adminClient();
const TZ = "Australia/Melbourne";
const created: string[] = [];
let olivia: Db;
let ned: Db;
let owner: Db;
let ownerUser: { id: string };
let g1: Db;
let g2: Db;
let g1Member = "";
let g2Member = "";
let serviceId = "";
let otherServiceId = "";
let pet = "";
let locationId = "";

function melbourne(days: number, hhmm: string): string {
  const base = new Date(Date.now() + days * 86_400_000);
  let date = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(base);
  if (new Date(`${date}T12:00:00Z`).getUTCDay() === 0) date = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(base.getTime() + 86_400_000));
  const guess = Date.parse(`${date}T${hhmm}:00Z`);
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(guess)).map((p) => [p.type, p.value]));
  return new Date(guess - (Date.parse(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:00Z`) - guess)).toISOString();
}
const localDate = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(iso));
const mode = (allocation_mode: "manual" | "open" | "automatic" | "assigned_only") => admin.from("booking_policies").update({ allocation_mode }).eq("business_id", PAWS);
async function submit(over: Record<string, unknown> = {}): Promise<string> {
  const r = await owner.rpc("submit_booking_request", { p_slug: "paws-test", p_owner_pet: pet, p_service_ids: [serviceId], p_preferred_start: melbourne(5, "10:00"), p_windows: [], p_notes: "R4 test", ...over } as never);
  if (r.error) throw new Error(r.error.message);
  return r.data as unknown as string;
}
const status = async (id: string) => (await admin.from("booking_requests").select("status, accepted_by, appointment_id, accept_deadline, assigned_groomer_id").eq("id", id).single()).data;
const kinds = async (userId: string) => ((await admin.from("notifications").select("kind").eq("user_id", userId)).data ?? []).map((n) => n.kind);

async function groomer(prefix: string) {
  const u = await newUser(prefix);
  created.push(u.id);
  const m = (await admin.from("business_members").insert({ business_id: PAWS, user_id: u.id, role: "groomer", display_name: prefix }).select("id").single()).data?.id ?? "";
  await admin.from("staff_hours").insert([1, 2, 3, 4, 5, 6].map((weekday) => ({ business_id: PAWS, member_id: m, location_id: locationId, weekday, starts: "08:00", ends: "17:00" })));
  return { db: await signedIn({ email: u.email, password: "a-strong-passphrase-42" }), member: m, userId: u.id };
}

beforeAll(async () => {
  olivia = await signedIn(OLIVIA);
  ned = await signedIn(NED);
  locationId = (await admin.from("locations").select("id").eq("business_id", PAWS).order("created_at").limit(1).single()).data?.id ?? "";
  serviceId = (await admin.from("services").insert({ business_id: PAWS, name: "R4 Bath", duration_minutes: 60, buffer_minutes: 0, base_price_cents: 6000, bookable_online: true }).select("id").single()).data?.id ?? "";
  otherServiceId = (await admin.from("services").insert({ business_id: PAWS, name: "R4 Hand strip", duration_minutes: 60, base_price_cents: 12000, bookable_online: true }).select("id").single()).data?.id ?? "";
  await admin.from("booking_policies").update({ groomer_commission_percent: 40 }).eq("business_id", PAWS);
  await admin.from("marketplace_profiles").upsert({ business_id: PAWS, listed: true });
  // Olivia (owner) isn't a candidate in these tests: give her no hours so only the groomers can take requests.
  const oliviaMember = (await admin.from("business_members").select("id").eq("business_id", PAWS).eq("user_id", OLIVIA.id).single()).data?.id ?? "";
  await admin.from("staff_hours").delete().eq("member_id", oliviaMember);
  const a = await groomer("r4-alex");
  const b = await groomer("r4-bea");
  g1 = a.db; g1Member = a.member; g2 = b.db; g2Member = b.member;
  const u = await newUser("r4-owner");
  created.push(u.id);
  ownerUser = u;
  owner = await signedIn({ email: u.email, password: "a-strong-passphrase-42" });
  pet = (await owner.from("owner_pets").insert({ user_id: u.id, name: "Biscuit", species: "dog", breed: "Golden Retriever", size: "large" }).select("id").single()).data?.id ?? "";
});

// Each test starts clean under the fair-use limits (3 open per salon, 10 a day): earlier requests are closed and aged.
beforeEach(async () => {
  if (!ownerUser) return;
  await admin.from("booking_requests").update({ status: "cancelled" }).eq("requester_id", ownerUser.id).in("status", ["submitted", "awaiting_review", "open", "accepted"]);
  await admin.from("booking_requests").update({ created_at: new Date(Date.now() - 2 * 86_400_000).toISOString() }).eq("requester_id", ownerUser.id);
});

afterAll(async () => {
  await mode("manual");
  await admin.from("booking_policies").update({ groomer_commission_percent: null }).eq("business_id", PAWS);
  await admin.from("booking_requests").delete().eq("business_id", PAWS);
  await admin.from("appointments").delete().eq("business_id", PAWS).eq("customer_notes", "R4 test");
  await admin.from("marketplace_profiles").delete().eq("business_id", PAWS);
  await admin.from("services").delete().in("id", [serviceId, otherServiceId]);
  await admin.from("business_members").delete().in("id", [g1Member, g2Member]);
  const oliviaMember = (await admin.from("business_members").select("id").eq("business_id", PAWS).eq("user_id", OLIVIA.id).single()).data?.id ?? "";
  await admin.from("staff_hours").insert([1, 2, 3, 4, 5, 6].map((weekday) => ({ business_id: PAWS, member_id: oliviaMember, location_id: locationId, weekday, starts: "08:00", ends: "17:00" })));
  for (const id of created) await admin.auth.admin.deleteUser(id);
});

describe("open requests and the shift board", () => {
  it("puts requests straight on eligible groomers' boards with a deadline and notifies them", async () => {
    await mode("open");
    const id = await submit();
    const s = await status(id);
    expect(s?.status).toBe("open");
    expect(Date.parse(s?.accept_deadline ?? "")).toBeLessThan(Date.parse(melbourne(5, "10:00")));
    const board = (await g1.rpc("shift_board", { p_business: PAWS })).data as Array<{ id: string; petName: string; commissionCents: number; services: string[] }>;
    expect(board.find((x) => x.id === id)).toMatchObject({ petName: "Biscuit", commissionCents: 2400, services: ["R4 Bath"] });
    expect(JSON.stringify(board)).not.toMatch(/@example\.test/);
    expect((await ned.rpc("shift_board", { p_business: PAWS })).data).toEqual([]);
    expect((await owner.rpc("shift_board", { p_business: PAWS })).data).toEqual([]);
    expect(await kinds((await admin.from("business_members").select("user_id").eq("id", g1Member).single()).data?.user_id ?? "")).toContain("request_open");
    expect(await kinds(OLIVIA.id)).toContain("request_new");
  });

  it("lets exactly one of two groomers win the same request", async () => {
    await mode("open");
    const id = await submit({ p_preferred_start: melbourne(6, "11:00") });
    const [a, b] = await Promise.all([g1.rpc("accept_booking_request", { p_id: id, p_starts_at: null } as never), g2.rpc("accept_booking_request", { p_id: id, p_starts_at: null } as never)]);
    const errors = [a.error?.message, b.error?.message];
    expect(errors.filter((e) => e === undefined)).toHaveLength(1);
    expect(errors).toContain("no_longer_available");
    const s = await status(id);
    expect(s?.status).toBe("confirmed");
    expect([g1Member, g2Member]).toContain(s?.accepted_by);
    expect((await admin.from("appointments").select("groomer_id, status").eq("id", s?.appointment_id ?? "").single()).data).toEqual({ groomer_id: s?.accepted_by, status: "confirmed" });
    expect(await kinds(ownerUser.id)).toContain("request_confirmed");
    expect(((await g1.rpc("shift_board", { p_business: PAWS })).data as Array<{ id: string }>).map((x) => x.id)).not.toContain(id);
  });

  it("checks capability, hours, assignment and the flexible windows", async () => {
    await mode("open");
    // Bea may only do the other service now.
    await olivia.from("member_services").insert({ business_id: PAWS, member_id: g2Member, service_id: otherServiceId });
    const id = await submit({ p_preferred_start: melbourne(7, "09:00") });
    expect(((await g2.rpc("shift_board", { p_business: PAWS })).data as Array<{ id: string }>).map((x) => x.id)).not.toContain(id);
    expect((await g2.rpc("accept_booking_request", { p_id: id, p_starts_at: null } as never)).error?.message).toBe("not_capable");
    await olivia.from("member_services").delete().eq("member_id", g2Member);

    const late = await submit({ p_preferred_start: melbourne(7, "16:30") });
    expect((await g1.rpc("accept_booking_request", { p_id: late, p_starts_at: null } as never)).error?.message).toBe("outside_hours");

    const day = localDate(melbourne(8, "12:00"));
    const flex = await submit({ p_preferred_start: null, p_windows: [{ date: day, part: "afternoon" }] });
    const board = (await g1.rpc("shift_board", { p_business: PAWS })).data as Array<{ id: string; starts: string[] }>;
    const starts = board.find((x) => x.id === flex)?.starts ?? [];
    expect(starts.length).toBeGreaterThan(0);
    expect(starts.every((s) => localDate(s) === day)).toBe(true);
    expect((await g1.rpc("accept_booking_request", { p_id: flex, p_starts_at: melbourne(8, "09:00") } as never)).error?.message).toBe("outside_window");
    expect((await g1.rpc("accept_booking_request", { p_id: flex, p_starts_at: starts[0] } as never)).error).toBeNull();
  });

  it("lets the front desk assign a request to one groomer, or take it back", async () => {
    await mode("assigned_only");
    const id = await submit({ p_preferred_start: melbourne(9, "10:00") });
    expect((await status(id))?.status).toBe("awaiting_review");
    expect((await g1.rpc("open_booking_request", { p_id: id, p_groomer: g2Member, p_hours: 12 } as never)).error?.message).toBe("not_found");
    expect((await olivia.rpc("open_booking_request", { p_id: id, p_groomer: g2Member, p_hours: 12 } as never)).error).toBeNull();
    expect(((await g1.rpc("shift_board", { p_business: PAWS })).data as Array<{ id: string }>).map((x) => x.id)).not.toContain(id);
    expect((await g1.rpc("accept_booking_request", { p_id: id, p_starts_at: null } as never)).error?.message).toBe("not_assigned");
    expect(await kinds((await admin.from("business_members").select("user_id").eq("id", g2Member).single()).data?.user_id ?? "")).toContain("request_assigned");
    expect((await olivia.rpc("close_booking_request", { p_id: id })).error).toBeNull();
    expect((await status(id))?.status).toBe("awaiting_review");
    expect((await g2.rpc("accept_booking_request", { p_id: id, p_starts_at: null } as never)).error?.message).toBe("no_longer_available");
  });
});

describe("automatic allocation", () => {
  it("books the first available capable groomer straight away, or falls back to the shift board", async () => {
    await mode("automatic");
    const id = await submit({ p_preferred_start: melbourne(10, "10:00") });
    const s = await status(id);
    expect(s?.status).toBe("confirmed");
    expect([g1Member, g2Member]).toContain(s?.accepted_by);
    // Nobody works at 16:30 for an hour.
    const none = await submit({ p_preferred_start: melbourne(10, "16:30") });
    expect((await status(none))?.status).toBe("open");
  });
});

describe("deadlines, expiry and notifications", () => {
  it("returns unclaimed requests to the front desk and expires ones whose time has passed", async () => {
    await mode("open");
    const id = await submit({ p_preferred_start: melbourne(11, "10:00") });
    await admin.from("booking_requests").update({ accept_deadline: new Date(Date.now() - 60_000).toISOString() }).eq("id", id);
    expect((await g1.rpc("accept_booking_request", { p_id: id, p_starts_at: null } as never)).error?.message).toBe("no_longer_available");
    await olivia.rpc("tidy_booking_requests", { p_business: PAWS });
    expect((await status(id))?.status).toBe("awaiting_review");
    expect(await kinds(OLIVIA.id)).toContain("request_unclaimed");
    await admin.from("booking_requests").update({ preferred_start: new Date(Date.now() - 3_600_000).toISOString() }).eq("id", id);
    await olivia.rpc("tidy_booking_requests", { p_business: PAWS });
    expect((await status(id))?.status).toBe("expired");
    expect(await kinds(ownerUser.id)).toContain("request_expired");
    // Outsiders can't tidy another business's requests.
    const other = await submit({ p_preferred_start: melbourne(12, "10:00") });
    await admin.from("booking_requests").update({ preferred_start: new Date(Date.now() - 3_600_000).toISOString() }).eq("id", other);
    await ned.rpc("tidy_booking_requests", { p_business: PAWS });
    expect((await status(other))?.status).not.toBe("expired");
  });

  it("keeps notifications private, lets people mark them read, and tells owners about progress", async () => {
    const mine = (await owner.from("notifications").select("id, kind, data")).data ?? [];
    expect(mine.length).toBeGreaterThan(0);
    expect((await g1.from("notifications").select("id").in("id", mine.map((n) => n.id))).data).toEqual([]);
    expect((await owner.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", mine[0]?.id ?? 0).select("id")).data).toHaveLength(1);
    expect((await g1.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", mine[0]?.id ?? 0).select("id")).data).toEqual([]);
    expect((await owner.from("notifications").update({ kind: "hacked" }).eq("id", mine[0]?.id ?? 0)).error).not.toBeNull();
    expect((await owner.from("notifications").insert({ user_id: ownerUser.id, audience: "customer", kind: "x", dedupe_key: "x" })).error).not.toBeNull();

    const confirmed = (await admin.from("booking_requests").select("appointment_id").eq("requester_id", ownerUser.id).eq("status", "confirmed").limit(1).single()).data?.appointment_id ?? "";
    await olivia.rpc("set_appointment_status", { p_id: confirmed, p_status: "in_progress" });
    await olivia.rpc("set_appointment_status", { p_id: confirmed, p_status: "completed" });
    expect(await kinds(ownerUser.id)).toEqual(expect.arrayContaining(["grooming_started", "grooming_completed"]));
  });

  it("queues a reminder once for an appointment in the next 24 hours", async () => {
    const r = (await admin.from("booking_requests").select("customer_id, pet_id").eq("requester_id", ownerUser.id).limit(1).single()).data;
    const soon = new Date(Date.now() + 3 * 3_600_000).toISOString();
    await admin.from("appointments").insert({ business_id: PAWS, location_id: locationId, customer_id: r?.customer_id ?? "", pet_id: r?.pet_id ?? "", groomer_id: g1Member, starts_at: soon, service_ends_at: new Date(Date.parse(soon) + 3_600_000).toISOString(), ends_at: new Date(Date.parse(soon) + 3_600_000).toISOString(), status: "confirmed", customer_notes: "R4 test" });
    await owner.rpc("queue_my_reminders");
    await owner.rpc("queue_my_reminders");
    expect((await kinds(ownerUser.id)).filter((k) => k === "appointment_reminder")).toHaveLength(1);
  });
});

describe("groomers' own hours", () => {
  it("only when the business allows it", async () => {
    const hours = [{ weekday: 1, starts: "09:00", ends: "15:00" }];
    expect((await g1.rpc("save_my_hours", { p_business: PAWS, p_location: locationId, p_hours: hours })).error?.message).toBe("not_allowed");
    await admin.from("booking_policies").update({ groomers_set_own_hours: true }).eq("business_id", PAWS);
    expect((await g1.rpc("save_my_hours", { p_business: PAWS, p_location: locationId, p_hours: hours })).error).toBeNull();
    expect((await admin.from("staff_hours").select("weekday, starts").eq("member_id", g1Member)).data).toEqual([{ weekday: 1, starts: "09:00:00" }]);
    await admin.from("booking_policies").update({ groomers_set_own_hours: false }).eq("business_id", PAWS);
    expect((await ned.rpc("save_my_hours", { p_business: PAWS, p_location: locationId, p_hours: hours })).error?.message).toBe("not_found");
  });
});
