import { describe, expect, it } from "vitest";
import { slugify } from "@lyra/platform/tenancy/slug";
import { can, canAssignRole } from "@lyra/platform/tenancy/roles";
import { businessDetailsSchema, createBusinessSchema, locationSchema } from "./schemas";

describe("business schemas", () => {
  it("accepts a valid new business and suggests slugs from names", () => {
    expect(createBusinessSchema.parse({ name: " Paws & Claws ", slug: "Paws-Claws", timezone: "Australia/Perth" })).toMatchObject({ name: "Paws & Claws", slug: "paws-claws" });
    expect(slugify("Paws & Claws Grooming!")).toBe("paws-claws-grooming");
    expect(slugify("Café Chien — Pet Spa")).toBe("cafe-chien-pet-spa");
  });
  it("rejects bad slugs, reserved words and unknown time zones", () => {
    expect(createBusinessSchema.safeParse({ name: "X Biz", slug: "a", timezone: "Australia/Perth" }).success).toBe(false);
    expect(createBusinessSchema.safeParse({ name: "X Biz", slug: "admin", timezone: "Australia/Perth" }).success).toBe(false);
    expect(createBusinessSchema.safeParse({ name: "X Biz", slug: "double--dash", timezone: "Australia/Perth" }).success).toBe(false);
    expect(createBusinessSchema.safeParse({ name: "X Biz", slug: "good-one", timezone: "Europe/London" }).success).toBe(false);
  });
  it("normalises ABNs, empty optional fields and postcodes", () => {
    expect(businessDetailsSchema.parse({ name: "Paws", timezone: "Australia/Sydney", abn: "51 824 753 556", gstRegistered: true, phone: "", email: "" })).toEqual({ name: "Paws", timezone: "Australia/Sydney", abn: "51824753556", gstRegistered: true, phone: null, email: null });
    expect(businessDetailsSchema.safeParse({ name: "Paws", timezone: "Australia/Sydney", abn: "123", gstRegistered: false, phone: "", email: "" }).success).toBe(false);
    expect(locationSchema.safeParse({ name: "Shop", addressLine: "", suburb: "", state: "VIC", postcode: "30000", isMobile: false }).success).toBe(false);
  });
});

describe("roles", () => {
  it("gives groomers care information but not contact details, payments or settings", () => {
    expect(can("groomer", "pets.care")).toBe(true);
    expect(can("groomer", "customers.contact")).toBe(false);
    expect(can("groomer", "payments.manage")).toBe(false);
    expect(can("groomer", "business.edit")).toBe(false);
    expect(can("receptionist", "customers.contact")).toBe(true);
    expect(can("manager", "billing.manage")).toBe(false);
    expect(can("owner", "billing.manage")).toBe(true);
    expect(can(null, "team.view")).toBe(false);
  });
  it("only lets owners create owners", () => {
    expect(canAssignRole("owner", "owner")).toBe(true);
    expect(canAssignRole("manager", "owner")).toBe(false);
    expect(canAssignRole("manager", "groomer")).toBe(true);
    expect(canAssignRole("groomer", "groomer")).toBe(false);
  });
});
