import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../packages/platform/src/database";
import { NEAT, NED, OLIVIA, PAWS, adminClient, anonClient, newUser, signedIn } from "./helpers";

/** Tenant isolation (brief §16, Test 15): one business can never see or change another's data. */
const admin = adminClient();
let olivia: SupabaseClient<Database>;
let ned: SupabaseClient<Database>;
const cleanup: string[] = [];

beforeAll(async () => {
  olivia = await signedIn(OLIVIA);
  ned = await signedIn(NED);
});
afterAll(async () => {
  for (const id of cleanup) await admin.auth.admin.deleteUser(id);
});

describe("business registration", () => {
  it("creates the business, owner membership, first location and an audit entry in one step", async () => {
    const u = await newUser("owner");
    cleanup.push(u.id);
    const db = await signedIn(u);
    const slug = `fresh-${Date.now()}`;
    expect((await db.rpc("business_slug_available", { p_slug: slug })).data).toBe(true);
    const { data: id, error } = await db.rpc("create_business", { p_name: "Fresh Paws", p_slug: slug, p_timezone: "Australia/Brisbane", p_location_name: "Studio" });
    expect(error).toBeNull();
    const { data: biz } = await db.from("businesses").select("name, slug, timezone, currency, plan, status").eq("id", id!).single();
    expect(biz).toEqual({ name: "Fresh Paws", slug, timezone: "Australia/Brisbane", currency: "AUD", plan: "starter", status: "active" });
    expect((await db.from("business_members").select("role, user_id").eq("business_id", id!)).data).toEqual([{ role: "owner", user_id: u.id }]);
    expect((await db.from("locations").select("name").eq("business_id", id!)).data).toEqual([{ name: "Studio" }]);
    expect((await db.from("audit_log").select("action").eq("business_id", id!)).data).toEqual([{ action: "business.created" }]);
    expect((await db.rpc("business_slug_available", { p_slug: slug })).data).toBe(false);
  });

  it("rejects taken, reserved and malformed slugs and bad time zones", async () => {
    const u = await newUser("slugs");
    cleanup.push(u.id);
    const db = await signedIn(u);
    expect((await db.rpc("create_business", { p_name: "Copy", p_slug: "paws-test", p_timezone: "Australia/Melbourne" })).error?.message).toMatch(/slug_taken/);
    expect((await db.rpc("create_business", { p_name: "Copy", p_slug: "admin", p_timezone: "Australia/Melbourne" })).error?.message).toMatch(/slug_invalid/);
    expect((await db.rpc("create_business", { p_name: "Copy", p_slug: "Bad Slug!", p_timezone: "Australia/Melbourne" })).error?.message).toMatch(/slug_invalid/);
    expect((await db.rpc("create_business", { p_name: "Copy", p_slug: "good-slug-x", p_timezone: "Mars/Olympus" })).error?.message).toMatch(/timezone_invalid/);
  });

  it("does not let anonymous visitors create businesses or check slugs", async () => {
    const anon = anonClient();
    expect((await anon.rpc("create_business", { p_name: "Anon", p_slug: "anon-biz", p_timezone: "Australia/Melbourne" })).error).not.toBeNull();
    expect((await anon.rpc("business_slug_available", { p_slug: "anon-biz" })).error).not.toBeNull();
  });
});

describe("tenant isolation", () => {
  it("shows each owner only their own business, members, locations and audit log", async () => {
    expect((await olivia.from("businesses").select("id")).data).toEqual([{ id: PAWS }]);
    expect((await ned.from("businesses").select("id")).data).toEqual([{ id: NEAT }]);
    for (const table of ["business_members", "locations", "audit_log"] as const) {
      expect((await olivia.from(table).select("business_id").eq("business_id", NEAT)).data, table).toEqual([]);
      expect((await ned.from(table).select("business_id").eq("business_id", PAWS)).data, table).toEqual([]);
    }
  });

  it("refuses writes into another business", async () => {
    const upd = await ned.from("businesses").update({ name: "Hijacked" }).eq("id", PAWS).select();
    expect(upd.data ?? []).toEqual([]);
    const loc = await ned.from("locations").insert({ business_id: PAWS, name: "Sneaky branch" });
    expect(loc.error).not.toBeNull();
    const join = await ned.from("business_members").insert({ business_id: PAWS, user_id: NED.id, role: "owner" });
    expect(join.error).not.toBeNull();
    expect((await admin.from("businesses").select("name").eq("id", PAWS).single()).data?.name).toBe("Paws Test Salon");
  });

  it("lets owners edit details but never plan, status or slug, and never insert businesses directly", async () => {
    expect((await olivia.from("businesses").update({ abn: "12345678901", gst_registered: true }).eq("id", PAWS)).error).toBeNull();
    expect((await olivia.from("businesses").update({ plan: "pro" }).eq("id", PAWS)).error).not.toBeNull();
    expect((await olivia.from("businesses").update({ status: "closed" }).eq("id", PAWS)).error).not.toBeNull();
    expect((await olivia.from("businesses").update({ slug: "stolen-slug" }).eq("id", PAWS)).error).not.toBeNull();
    expect((await olivia.from("businesses").insert({ name: "Direct", slug: "direct-insert" })).error).not.toBeNull();
    const { data } = await admin.from("businesses").select("plan, status, slug, abn, gst_registered").eq("id", PAWS).single();
    expect(data).toEqual({ plan: "starter", status: "active", slug: "paws-test", abn: "12345678901", gst_registered: true });
    await admin.from("businesses").update({ abn: null, gst_registered: false }).eq("id", PAWS);
  });

  it("limits settings to owners and managers: a groomer can read but not change the business or locations", async () => {
    const g = await newUser("groomer");
    cleanup.push(g.id);
    await admin.from("business_members").insert({ business_id: PAWS, user_id: g.id, role: "groomer" });
    const groomer = await signedIn(g);
    expect((await groomer.from("businesses").select("id")).data).toEqual([{ id: PAWS }]);
    expect((await groomer.from("businesses").update({ name: "Groomer was here" }).eq("id", PAWS).select()).data ?? []).toEqual([]);
    expect((await groomer.from("locations").insert({ business_id: PAWS, name: "Groomer branch" })).error).not.toBeNull();
    expect((await groomer.from("audit_log").select("id").eq("business_id", PAWS)).data).toEqual([]);
  });

  it("drops access as soon as a membership is suspended", async () => {
    const r = await newUser("suspended");
    cleanup.push(r.id);
    await admin.from("business_members").insert({ business_id: PAWS, user_id: r.id, role: "receptionist", status: "suspended" });
    const db = await signedIn(r);
    expect((await db.from("businesses").select("id")).data).toEqual([]);
    expect((await db.from("locations").select("id")).data).toEqual([]);
  });

  it("gives anonymous visitors nothing", async () => {
    const anon = anonClient();
    for (const table of ["businesses", "business_members", "locations", "audit_log", "profiles"] as const) expect((await anon.from(table).select("*")).data ?? [], table).toEqual([]);
  });
});
