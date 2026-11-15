import { describe, expect, it } from "vitest";
import { ageLabel, ownerPetSchema, requestSchema } from "./schemas";

const pet = { name: "Mochi", species: "cat", breed: "", size: "", dateOfBirth: "", estimatedAge: "", weightKg: "", coatType: "", groomingPreferences: "", careNotes: "" };

describe("owner pet input", () => {
  it("turns blanks into nulls and checks numbers and dates", () => {
    expect(ownerPetSchema.parse(pet)).toMatchObject({ name: "Mochi", breed: null, size: null, weightKg: null });
    expect(ownerPetSchema.parse({ ...pet, weightKg: "4.5", size: "small" })).toMatchObject({ weightKg: 4.5, size: "small" });
    expect(ownerPetSchema.safeParse({ ...pet, weightKg: "heavy" }).success).toBe(false);
    expect(ownerPetSchema.safeParse({ ...pet, dateOfBirth: "2999-01-01" }).success).toBe(false);
    expect(ownerPetSchema.safeParse({ ...pet, name: " " }).success).toBe(false);
  });
});

describe("request input", () => {
  const base = { slug: "fluff-and-fold", ownerPetId: crypto.randomUUID(), serviceIds: [crypto.randomUUID()], preferredStart: null, windows: [], notes: "" };
  it("needs a time or flexible days, and at least one service", () => {
    expect(requestSchema.safeParse(base).success).toBe(false);
    expect(requestSchema.safeParse({ ...base, windows: [{ date: "2026-12-01", part: "morning" }] }).success).toBe(true);
    expect(requestSchema.safeParse({ ...base, preferredStart: "2026-12-01T09:00:00+11:00" }).success).toBe(true);
    expect(requestSchema.safeParse({ ...base, serviceIds: [], preferredStart: "2026-12-01T09:00:00+11:00" }).success).toBe(false);
    expect(requestSchema.safeParse({ ...base, windows: [{ date: "2026-12-01", part: "night" }] }).success).toBe(false);
  });
});

describe("pet age", () => {
  it("reads years, months or the estimate", () => {
    const today = new Date("2026-11-16T00:00:00Z");
    expect(ageLabel("2020-03-10", null, today)).toBe("6 years");
    expect(ageLabel("2025-12-20", null, today)).toBe("10 months");
    expect(ageLabel(null, 3, today)).toBe("About 3 years");
    expect(ageLabel(null, null, today)).toBeNull();
  });
});
