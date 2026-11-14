import { describe, expect, it } from "vitest";
import { isGroomingPhotoPath } from "../grooming/schemas";
import { ageLabel, petSchema } from "../pets/schemas";
import { contactSchema, segmentsFor, type DirectoryRow } from "./schemas";

const row = (o: Partial<DirectoryRow>): DirectoryRow => ({ id: "c", first_name: "A", last_name: null, is_vip: false, created_at: "2026-01-01T00:00:00Z", pet_names: [], groom_count: 0, last_groomed_on: null, next_due_on: null, ...o });

describe("customer segments", () => {
  it("derives new, returning, VIP, inactive and due from real records", () => {
    const today = "2026-11-16";
    expect(segmentsFor(row({ created_at: "2026-11-01T10:00:00Z" }), today)).toEqual(["all", "new"]);
    expect(segmentsFor(row({ groom_count: 3, last_groomed_on: "2026-11-01", next_due_on: "2026-12-13" }), today)).toEqual(["all", "returning"]);
    expect(segmentsFor(row({ is_vip: true, groom_count: 1, last_groomed_on: "2026-07-01", next_due_on: "2026-08-12" }), today)).toEqual(["all", "vip", "inactive", "due"]);
  });
});

describe("contact and pet validation", () => {
  it("normalises contact details and rejects bad ones", () => {
    expect(contactSchema.parse({ email: "Sarah@Example.TEST", mobile: "0412 345 678", addressLine: "", suburb: "", state: "", postcode: "3065" })).toEqual({ email: "sarah@example.test", mobile: "0412 345 678", addressLine: null, suburb: null, state: null, postcode: "3065" });
    expect(contactSchema.safeParse({ email: "nope", mobile: "", addressLine: "", suburb: "", state: "", postcode: "" }).success).toBe(false);
    expect(contactSchema.safeParse({ email: "", mobile: "call me", addressLine: "", suburb: "", state: "", postcode: "" }).success).toBe(false);
  });
  it("parses numbers in pet profiles and labels ages", () => {
    const base = Object.fromEntries(Object.keys(petSchema.shape).map((k) => [k, ""])) as Record<string, string>;
    const p = petSchema.parse({ ...base, name: "Max", species: "dog", sex: "male", weightKg: "32.5", groomIntervalWeeks: "6", size: "large" });
    expect(p).toMatchObject({ name: "Max", weightKg: 32.5, groomIntervalWeeks: 6, size: "large", breed: null });
    expect(petSchema.safeParse({ ...base, name: "Max", species: "dog", sex: "male", weightKg: "heavy" }).success).toBe(false);
    expect(ageLabel("2025-03-20", null, "2026-11-16")).toBe("19 months");
    expect(ageLabel("2019-11-17", null, "2026-11-16")).toBe("6 years");
    expect(ageLabel(null, 4, "2026-11-16")).toBe("About 4 years");
  });
  it("only accepts photo paths under the same business and record", () => {
    const b = "a0000000-0000-4000-8000-000000000001";
    const r = "11111111-2222-4333-8444-555555555555";
    const f = "99999999-8888-4777-8666-555555555555";
    expect(isGroomingPhotoPath(`${b}/grooming/${r}/${f}.jpg`, b, r)).toBe(true);
    expect(isGroomingPhotoPath(`b0000000-0000-4000-8000-000000000002/grooming/${r}/${f}.jpg`, b, r)).toBe(false);
    expect(isGroomingPhotoPath(`${b}/grooming/${r}/../x.jpg`, b, r)).toBe(false);
  });
});
