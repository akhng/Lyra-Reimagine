/**
 * Price estimates for a service and a pet. A breed rule beats a size rule,
 * which beats the base price; coat-condition rules add a surcharge. The
 * groomer can still adjust the final price for the work actually done
 * (Phase 3/4), so this is an estimate shown to staff and customers.
 */
export const PET_SIZES = ["toy", "small", "medium", "large", "giant"] as const;
export type PetSize = (typeof PET_SIZES)[number];

export const COAT_CONDITIONS = ["matted", "heavily_matted", "double_coat_deshed", "flea_treatment"] as const;
export type CoatCondition = (typeof COAT_CONDITIONS)[number];

export type PriceRule = { kind: "size" | "breed" | "coat_condition"; matchValue: string; priceCents: number };
export type PricedService = { basePriceCents: number; priceFrom: boolean; rules: PriceRule[] };
export type PetForPricing = { size: PetSize | null; breed: string | null };

export type PriceEstimate = { totalCents: number; baseCents: number; basis: "breed" | "size" | "base"; surcharges: Array<{ condition: string; cents: number }>; from: boolean };

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

export function estimatePrice(service: PricedService, pet: PetForPricing, conditions: readonly string[] = []): PriceEstimate {
  const breedRule = pet.breed ? service.rules.find((r) => r.kind === "breed" && norm(r.matchValue) === norm(pet.breed!)) : undefined; // breed checked
  const sizeRule = pet.size ? service.rules.find((r) => r.kind === "size" && r.matchValue === pet.size) : undefined;
  const [baseCents, basis] = breedRule ? [breedRule.priceCents, "breed" as const] : sizeRule ? [sizeRule.priceCents, "size" as const] : [service.basePriceCents, "base" as const];
  const surcharges = [...new Set(conditions)].flatMap((c) => {
    const rule = service.rules.find((r) => r.kind === "coat_condition" && r.matchValue === c);
    return rule ? [{ condition: c, cents: rule.priceCents }] : [];
  });
  // "From" pricing stays a minimum until a breed or size rule pins it down.
  return { totalCents: baseCents + surcharges.reduce((n, s) => n + s.cents, 0), baseCents, basis, surcharges, from: service.priceFrom && basis === "base" };
}

/** A$ with GST-inclusive cents, e.g. 8550 → "$85.50". */
export function formatAud(cents: number): string {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(cents / 100);
}

/** "85" or "85.50" → 8550; null when not a valid non-negative amount with at most 2 decimals. */
export function parseAudToCents(input: string): number | null {
  const s = input.trim().replace(/^\$/, "").replace(/,/g, "");
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(s)) return null;
  const [dollars, cents = ""] = s.split(".");
  return Number(dollars) * 100 + Number(cents.padEnd(2, "0"));
}
