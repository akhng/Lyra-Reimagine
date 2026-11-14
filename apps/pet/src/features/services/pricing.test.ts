import { describe, expect, it } from "vitest";
import { estimatePrice, formatAud, parseAudToCents, type PricedService } from "./pricing";

const service: PricedService = {
  basePriceCents: 6000,
  priceFrom: true,
  rules: [
    { kind: "size", matchValue: "small", priceCents: 7000 },
    { kind: "size", matchValue: "large", priceCents: 11000 },
    { kind: "breed", matchValue: "Golden Retriever", priceCents: 13000 },
    { kind: "coat_condition", matchValue: "matted", priceCents: 2500 },
    { kind: "coat_condition", matchValue: "flea_treatment", priceCents: 1500 },
  ],
};

describe("estimatePrice", () => {
  it("uses the breed rule before the size rule, and the size rule before the base price", () => {
    expect(estimatePrice(service, { size: "large", breed: "golden  retriever " })).toMatchObject({ totalCents: 13000, basis: "breed", from: false });
    expect(estimatePrice(service, { size: "large", breed: "Labrador" })).toMatchObject({ totalCents: 11000, basis: "size", from: false });
    expect(estimatePrice(service, { size: null, breed: null })).toMatchObject({ totalCents: 6000, basis: "base", from: true });
  });
  it("adds coat-condition surcharges once each, ignoring unknown conditions", () => {
    const e = estimatePrice(service, { size: "small", breed: null }, ["matted", "matted", "flea_treatment", "unknown"]);
    expect(e.totalCents).toBe(7000 + 2500 + 1500);
    expect(e.surcharges).toEqual([{ condition: "matted", cents: 2500 }, { condition: "flea_treatment", cents: 1500 }]);
  });
  it("doesn't assume every pet of a breed costs the same when no rule exists", () => {
    expect(estimatePrice({ ...service, rules: [] }, { size: "giant", breed: "Golden Retriever" }).basis).toBe("base");
  });
});

describe("money", () => {
  it("formats and parses Australian dollars", () => {
    expect(formatAud(8550)).toBe("$85.50");
    expect(parseAudToCents("85")).toBe(8500);
    expect(parseAudToCents("$1,085.5")).toBe(108550);
    for (const bad of ["-1", "abc", "1.234", ""]) expect(parseAudToCents(bad)).toBeNull();
  });
});
