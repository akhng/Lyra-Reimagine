import { z } from "zod";

/** Customer portal (ADR 0003): what pet owners enter and what we read back. */
export const SPECIES = ["dog", "cat", "other"] as const;
export const SIZES = ["toy", "small", "medium", "large", "giant"] as const;
export const PARTS = ["morning", "afternoon", "any"] as const;
export const PART_LABEL: Record<(typeof PARTS)[number], string> = { morning: "Morning", afternoon: "Afternoon", any: "Any time" };

const optionalText = (max: number) => z.string().trim().max(max).transform((v) => (v === "" ? null : v));
const optionalNumber = (min: number, max: number, message: string) =>
  z
    .string()
    .trim()
    .transform((v, ctx) => {
      if (v === "") return null;
      const n = Number(v);
      if (!Number.isFinite(n) || n < min || n > max) {
        ctx.addIssue({ code: "custom", message });
        return z.NEVER;
      }
      return n;
    });

export const ownerPetSchema = z.object({
  name: z.string().trim().min(1, "Give your pet's name").max(60),
  species: z.enum(SPECIES),
  breed: optionalText(80),
  size: z.enum(SIZES).or(z.literal("")).transform((v) => (v === "" ? null : v)),
  dateOfBirth: z
    .string()
    .trim()
    .refine((v) => v === "" || (/^\d{4}-\d{2}-\d{2}$/.test(v) && v <= new Date().toISOString().slice(0, 10)), "Use a date in the past")
    .transform((v) => (v === "" ? null : v)),
  estimatedAge: optionalNumber(0, 40, "Age in years, e.g. 3 or 2.5"),
  weightKg: optionalNumber(0, 150, "Weight in kg, e.g. 12.5"),
  coatType: optionalText(80),
  groomingPreferences: optionalText(1000),
  careNotes: optionalText(1000),
});
export type OwnerPetInput = z.infer<typeof ownerPetSchema>;

const windowSchema = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), part: z.enum(PARTS) });
export const requestSchema = z
  .object({
    slug: z.string().trim().min(2).max(60),
    ownerPetId: z.uuid(),
    serviceIds: z.array(z.uuid()).min(1, "Choose at least one service").max(6),
    preferredStart: z.iso.datetime({ offset: true }).nullable(),
    windows: z.array(windowSchema).max(3),
    notes: z.string().trim().max(1000),
  })
  .refine((v) => v.preferredStart !== null || v.windows.length > 0, { message: "Choose a time or some flexible days", path: ["preferredStart"] });
export type RequestInput = z.infer<typeof requestSchema>;

export const REQUEST_ERRORS: Record<string, string> = {
  not_found: "That salon isn't taking requests through Lyra Pet right now.",
  not_accepting: "That salon isn't taking new requests right now.",
  invalid_pet: "Choose one of your pets.",
  invalid_services: "One of those services isn't available any more. Please choose again.",
  invalid_time: "Choose a time at least an hour from now and within the next 90 days.",
  rate_limited: "You already have several open requests here. Wait for the salon to reply, or cancel one first.",
  email_unverified: "Please confirm your email address first (check your inbox).",
  too_late: "It's too late to cancel online. Please contact the salon.",
};

/** Request status for people (ADR 0003 statuses, as a pet owner reads them). */
export const STATUS_TEXT: Record<string, { label: string; tone: "neutral" | "primary" | "success" | "warning" | "danger" | "coral" | "sky" | "butter" }> = {
  draft: { label: "Draft", tone: "neutral" },
  submitted: { label: "Submitted", tone: "sky" },
  awaiting_review: { label: "Awaiting the salon", tone: "butter" },
  open: { label: "Finding a groomer", tone: "butter" },
  accepted: { label: "Groomer found", tone: "primary" },
  confirmed: { label: "Confirmed", tone: "success" },
  in_progress: { label: "Grooming now", tone: "primary" },
  completed: { label: "Completed", tone: "success" },
  cancelled: { label: "Cancelled", tone: "neutral" },
  rejected: { label: "Not accepted", tone: "danger" },
  expired: { label: "Expired", tone: "neutral" },
};

export const ACTIVE_REQUEST = ["submitted", "awaiting_review", "open", "accepted"];

/** Age in years from a birth date (or the estimate), for pet cards. */
export function ageLabel(dob: string | null, estimate: number | null, today = new Date()): string | null {
  if (dob) {
    const d = new Date(`${dob}T00:00:00Z`);
    let years = today.getUTCFullYear() - d.getUTCFullYear();
    const months = today.getUTCMonth() - d.getUTCMonth() + (today.getUTCDate() < d.getUTCDate() ? -1 : 0);
    if (months < 0) years -= 1;
    if (years <= 0) {
      const m = (today.getUTCFullYear() - d.getUTCFullYear()) * 12 + months;
      return `${Math.max(0, m + (m < 0 ? 12 : 0))} months`;
    }
    return `${years} ${years === 1 ? "year" : "years"}`;
  }
  return estimate !== null ? `About ${estimate} ${estimate === 1 ? "year" : "years"}` : null;
}
