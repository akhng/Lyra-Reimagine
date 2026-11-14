import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../packages/platform/src/database";
import { NEAT, NED, OLIVIA, PAWS, adminClient, newUser, signedIn } from "./helpers";

/** Phase 2: customers, contacts, pets, services, pricing, grooming records and photos stay inside their business, by role. */
const admin = adminClient();
let olivia: SupabaseClient<Database>;
let ned: SupabaseClient<Database>;
let groomer: SupabaseClient<Database>;
let groomerUser: { id: string };
let groomerMemberId = "";
let customerId = "";
let petId = "";
let serviceId = "";
let recordId = "";
const PNG = Buffer.from("89504e470d0a1a0a0000000d4948445200000001000000010806000000" + "1f15c4890000000d4944415478da63fcffff3f0300050001ff5dce3d0000000049454e44ae426082", "hex");

beforeAll(async () => {
  olivia = await signedIn(OLIVIA);
  ned = await signedIn(NED);
  const g = await newUser("p2-groomer");
  groomerUser = g;
  const { data: m } = await admin.from("business_members").insert({ business_id: PAWS, user_id: g.id, role: "groomer", display_name: "Gus Groomer" }).select("id").single();
  groomerMemberId = m!.id; // insert succeeded
  groomer = await signedIn(g);
});
afterAll(async () => {
  await admin.from("customers").delete().eq("business_id", PAWS);
  await admin.from("services").delete().eq("business_id", PAWS);
  await admin.storage.from("media").remove([`${PAWS}/grooming/x.png`]);
  await admin.auth.admin.deleteUser(groomerUser.id);
});

describe("customers, contacts and pets", () => {
  it("lets the owner create a customer with contact details and two pets", async () => {
    const { data: c, error } = await olivia.from("customers").insert({ business_id: PAWS, first_name: "Sarah", last_name: "Thompson", preferred_contact: "sms" }).select("id").single();
    expect(error).toBeNull();
    customerId = c!.id;
    expect((await olivia.from("customer_contacts").insert({ customer_id: customerId, business_id: PAWS, email: "sarah@example.test", mobile: "0412 345 678", suburb: "Fitzroy", state: "VIC", postcode: "3065" })).error).toBeNull();
    const { data: pets, error: pe } = await olivia.from("pets").insert([
      { business_id: PAWS, customer_id: customerId, name: "Max", breed: "Golden Retriever", size: "large", groom_interval_weeks: 6, allergies: "Oatmeal shampoo (owner reported)" },
      { business_id: PAWS, customer_id: customerId, name: "Bella", breed: "Cavoodle", size: "small", groom_interval_weeks: 4 },
    ]).select("id, name");
    expect(pe).toBeNull();
    petId = pets!.find((p) => p.name === "Max")!.id;
  });

  it("hides contact details from groomers while showing names, pets and care information", async () => {
    expect((await groomer.from("customers").select("first_name").eq("id", customerId)).data).toEqual([{ first_name: "Sarah" }]);
    expect((await groomer.from("customer_contacts").select("*").eq("customer_id", customerId)).data).toEqual([]);
    expect((await groomer.from("pets").select("allergies").eq("id", petId).single()).data?.allergies).toMatch(/Oatmeal/);
    expect((await groomer.from("customers").update({ first_name: "Changed" }).eq("id", customerId).select()).data ?? []).toEqual([]);
    expect((await groomer.from("pets").update({ preferred_cut: "Teddy bear, 13mm body" }).eq("id", petId)).error).toBeNull();
  });

  it("searches by name, pet name, email and mobile digits — contact matches only for roles that can see contacts", async () => {
    const find = async (db: SupabaseClient<Database>, q: string) => ((await db.rpc("customer_directory", { p_business: PAWS, p_query: q })).data ?? []).map((r) => r.first_name);
    expect(await find(olivia, "thomp")).toEqual(["Sarah"]);
    expect(await find(olivia, "bella")).toEqual(["Sarah"]);
    expect(await find(olivia, "sarah@example")).toEqual(["Sarah"]);
    expect(await find(olivia, "0412345")).toEqual(["Sarah"]);
    expect(await find(groomer, "max")).toEqual(["Sarah"]);
    expect(await find(groomer, "0412345")).toEqual([]);
    expect(await find(ned, "sarah")).toEqual([]);
  });

  it("keeps everything invisible and unwritable from another business", async () => {
    for (const t of ["customers", "customer_contacts", "pets"] as const) expect((await ned.from(t).select("*").eq("business_id", PAWS)).data, t).toEqual([]);
    expect((await ned.from("pets").update({ name: "Stolen" }).eq("id", petId).select()).data ?? []).toEqual([]);
    expect((await ned.from("customers").insert({ business_id: PAWS, first_name: "Spy" })).error).not.toBeNull();
  });

  it("refuses links across businesses, even for a member of both sides' data shapes", async () => {
    const { data: nedCustomer } = await ned.from("customers").insert({ business_id: NEAT, first_name: "Nina" }).select("id").single();
    // A Neat Coat pet pointing at a Paws customer: the composite key rejects it.
    expect((await ned.from("pets").insert({ business_id: NEAT, customer_id: customerId, name: "Crossover" })).error).not.toBeNull();
    // A Paws customer's preferred groomer can't be a member of another business.
    const { data: nedMember } = await admin.from("business_members").select("id").eq("business_id", NEAT).eq("user_id", NED.id).single();
    expect((await olivia.from("customers").update({ preferred_groomer_id: nedMember!.id }).eq("id", customerId)).error).not.toBeNull();
    await admin.from("customers").delete().eq("id", nedCustomer!.id);
  });
});

describe("services and pricing", () => {
  it("lets owners manage services and price rules, and groomers only read them", async () => {
    const { data: s, error } = await olivia.from("services").insert({ business_id: PAWS, name: "Full groom", duration_minutes: 90, base_price_cents: 8000, price_from: true }).select("id").single();
    expect(error).toBeNull();
    serviceId = s!.id;
    expect((await olivia.from("service_price_rules").insert([{ business_id: PAWS, service_id: serviceId, kind: "size", match_value: "large", price_cents: 12000 }, { business_id: PAWS, service_id: serviceId, kind: "coat_condition", match_value: "matted", price_cents: 2500 }])).error).toBeNull();
    expect((await groomer.from("service_price_rules").select("kind").eq("service_id", serviceId)).data).toHaveLength(2);
    expect((await groomer.from("services").insert({ business_id: PAWS, name: "Groomer special", duration_minutes: 30, base_price_cents: 1 })).error).not.toBeNull();
    expect((await groomer.from("services").update({ base_price_cents: 1 }).eq("id", serviceId).select()).data ?? []).toEqual([]);
    expect((await ned.from("services").select("id").eq("business_id", PAWS)).data).toEqual([]);
  });
});

describe("grooming records and photos", () => {
  it("lets a groomer record a groom with before and after photos stored under the business", async () => {
    const { data: r, error } = await groomer.from("grooming_records").insert({ business_id: PAWS, pet_id: petId, groomed_on: "2026-11-10", groomer_id: groomerMemberId, service_ids: [serviceId], haircut: "Teddy bear, 13mm body, scissored face", shampoo: "Hypoallergenic", duration_minutes: 95 }).select("id").single();
    expect(error).toBeNull();
    recordId = r!.id;
    const path = `${PAWS}/grooming/${recordId}/${crypto.randomUUID()}.png`;
    expect((await groomer.storage.from("media").upload(path, PNG, { contentType: "image/png" })).error).toBeNull();
    expect((await groomer.from("grooming_photos").insert({ business_id: PAWS, record_id: recordId, kind: "before", storage_path: path })).error).toBeNull();
    expect((await olivia.storage.from("media").download(path)).error).toBeNull();
    // Another business can't read the photo row or the file.
    expect((await ned.from("grooming_photos").select("id").eq("record_id", recordId)).data).toEqual([]);
    expect((await ned.storage.from("media").download(path)).data).toBeNull();
  });

  it("refuses uploads into another business's folder and photo rows pointing there", async () => {
    const foreign = `${PAWS}/grooming/${recordId}/${crypto.randomUUID()}.png`;
    expect((await ned.storage.from("media").upload(foreign, PNG, { contentType: "image/png" })).error).not.toBeNull();
    expect((await ned.from("grooming_photos").insert({ business_id: NEAT, record_id: recordId, kind: "after", storage_path: `${NEAT}/grooming/${recordId}/${crypto.randomUUID()}.png` })).error).not.toBeNull();
  });

  it("lets only the author or a manager edit a record, and nobody delete it", async () => {
    const r2 = await newUser("p2-receptionist");
    await admin.from("business_members").insert({ business_id: PAWS, user_id: r2.id, role: "receptionist" });
    const receptionist = await signedIn(r2);
    expect((await receptionist.from("grooming_records").update({ haircut: "Changed" }).eq("id", recordId).select()).data ?? []).toEqual([]);
    expect((await olivia.from("grooming_records").update({ customer_feedback: "Loved it" }).eq("id", recordId).select()).data).toHaveLength(1);
    expect((await groomer.from("grooming_records").delete().eq("id", recordId)).error).not.toBeNull();
    await admin.auth.admin.deleteUser(r2.id);
  });

  it("reports grooming activity and the next due date in the customer directory", async () => {
    const { data } = await olivia.rpc("customer_directory", { p_business: PAWS });
    const row = data!.find((r) => r.id === customerId)!;
    expect(row).toMatchObject({ groom_count: 1, last_groomed_on: "2026-11-10", next_due_on: "2026-12-22" });
    expect(row.pet_names).toEqual(["Bella", "Max"]);
  });
});
