import { afterAll, describe, expect, it } from "vitest";
import { NEAT, NED, OLIVIA, PAWS, adminClient, anonClient, newUser, signedIn } from "./helpers";

/** Transformation R2: personal dashboard layouts are private to each person and each business they belong to. */
const admin = adminClient();
const created: string[] = [];

afterAll(async () => {
  await admin.from("dashboard_layouts").delete().in("business_id", [PAWS, NEAT]);
  for (const id of created) await admin.auth.admin.deleteUser(id);
});

describe("dashboard layouts", () => {
  it("lets a member save and read their own layout", async () => {
    const olivia = await signedIn(OLIVIA);
    const layout = { order: ["revenue", "today"], sizes: { revenue: "l" }, pinned: ["revenue"], hidden: [] };
    expect((await olivia.from("dashboard_layouts").upsert({ user_id: OLIVIA.id, business_id: PAWS, layout })).error).toBeNull();
    const { data } = await olivia.from("dashboard_layouts").select("layout").eq("business_id", PAWS).single();
    expect(data?.layout).toEqual(layout);
  });

  it("refuses layouts for another person or a business you don't belong to", async () => {
    const olivia = await signedIn(OLIVIA);
    expect((await olivia.from("dashboard_layouts").insert({ user_id: NED.id, business_id: PAWS, layout: {} })).error).not.toBeNull();
    expect((await olivia.from("dashboard_layouts").insert({ user_id: OLIVIA.id, business_id: NEAT, layout: {} })).error).not.toBeNull();
    const ned = await signedIn(NED);
    expect((await ned.from("dashboard_layouts").select("user_id").eq("business_id", PAWS)).data).toEqual([]);
    expect((await anonClient().from("dashboard_layouts").select("user_id")).data ?? []).toEqual([]);
  });

  it("keeps colleagues' layouts apart and rejects oversized layouts", async () => {
    const u = await newUser("layout-colleague");
    created.push(u.id);
    await admin.from("business_members").insert({ business_id: PAWS, user_id: u.id, role: "groomer", display_name: "Colleague" });
    const colleague = await signedIn(u);
    expect((await colleague.from("dashboard_layouts").select("user_id")).data).toEqual([]);
    expect((await colleague.from("dashboard_layouts").update({ layout: { order: [] } }).eq("user_id", OLIVIA.id).select("user_id")).data).toEqual([]);
    const huge = { order: Array.from({ length: 2000 }, (_, i) => `tile-${i}`) };
    expect((await colleague.from("dashboard_layouts").insert({ user_id: u.id, business_id: PAWS, layout: huge })).error).not.toBeNull();
    await admin.from("business_members").delete().eq("user_id", u.id);
  });
});
