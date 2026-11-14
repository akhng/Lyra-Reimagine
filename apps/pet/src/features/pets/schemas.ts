import type { Database } from "@lyra/platform/database";
import { z } from "zod";
import { PET_SIZES } from "../services/pricing";

const optional = (max: number) => z.string().trim().max(max).transform((v) => (v === "" ? null : v));
const optionalNumber = (min: number, max: number, message: string) =>
  z
    .string()
    .trim()
    .refine((v) => v === "" || (/^\d+(\.\d+)?$/.test(v) && Number(v) >= min && Number(v) <= max), message)
    .transform((v) => (v === "" ? null : Number(v)));

export const petSchema = z.object({
  name: z.string().trim().min(1, "Enter the pet's name").max(60),
  species: z.enum(["dog", "cat", "other"]),
  breed: optional(80),
  size: z.enum(["", ...PET_SIZES]).transform((v) => (v === "" ? null : v)),
  dateOfBirth: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "Use a valid date")
    .transform((v) => (v === "" ? null : v)),
  estimatedAgeYears: optionalNumber(0, 40, "Enter an age between 0 and 40"),
  sex: z.enum(["male", "female", "unknown"]),
  weightKg: optionalNumber(0, 150, "Enter a weight in kg"),
  coatType: optional(60),
  coatColour: optional(60),
  microchip: z
    .string()
    .trim()
    .refine((v) => v === "" || /^[0-9A-Za-z]{9,20}$/.test(v), "Microchip numbers are 9–20 letters or digits")
    .transform((v) => (v === "" ? null : v)),
  groomIntervalWeeks: optionalNumber(1, 52, "Every 1–52 weeks").transform((v) => (v === null ? null : Math.round(v))),
  preferredCut: optional(200),
  coatLength: optional(100),
  groomingStyle: optional(200),
  shampoo: optional(120),
  finishingProducts: optional(200),
  nailPreferences: optional(200),
  earCleaning: optional(200),
  behaviour: optional(1000),
  noiseSensitivity: optional(200),
  handlingPreferences: optional(1000),
  allergies: optional(1000),
  sensitivities: optional(1000),
  medicalNotes: optional(2000),
  skinCoatConcerns: optional(1000),
  handlingPrecautions: optional(1000),
  emergencyContact: optional(200),
});

export type PetInput = z.infer<typeof petSchema>;

/** Form field name → database column. */
type PetUpdate = Database["public"]["Tables"]["pets"]["Update"];
export type PetRow = Required<Pick<PetUpdate, "name" | "species" | "breed" | "size" | "date_of_birth" | "estimated_age_years" | "sex" | "weight_kg" | "coat_type" | "coat_colour" | "microchip" | "groom_interval_weeks" | "preferred_cut" | "coat_length" | "grooming_style" | "shampoo" | "finishing_products" | "nail_preferences" | "ear_cleaning" | "behaviour" | "noise_sensitivity" | "handling_preferences" | "allergies" | "sensitivities" | "medical_notes" | "skin_coat_concerns" | "handling_precautions" | "emergency_contact">>;

export const PET_COLUMNS: Record<keyof PetInput, string> = {
  name: "name", species: "species", breed: "breed", size: "size", dateOfBirth: "date_of_birth", estimatedAgeYears: "estimated_age_years", sex: "sex", weightKg: "weight_kg",
  coatType: "coat_type", coatColour: "coat_colour", microchip: "microchip", groomIntervalWeeks: "groom_interval_weeks", preferredCut: "preferred_cut", coatLength: "coat_length",
  groomingStyle: "grooming_style", shampoo: "shampoo", finishingProducts: "finishing_products", nailPreferences: "nail_preferences", earCleaning: "ear_cleaning", behaviour: "behaviour",
  noiseSensitivity: "noise_sensitivity", handlingPreferences: "handling_preferences", allergies: "allergies", sensitivities: "sensitivities", medicalNotes: "medical_notes",
  skinCoatConcerns: "skin_coat_concerns", handlingPrecautions: "handling_precautions", emergencyContact: "emergency_contact",
};

/** The editable pet columns as a typed table row (snake_case). */
export function toPetRow(p: PetInput): PetRow {
  return Object.fromEntries(Object.entries(p).map(([k, v]) => [PET_COLUMNS[k as keyof PetInput], v])) as PetRow;
}

/** Age label from date of birth (preferred) or the estimate, as of `today` (YYYY-MM-DD). */
export function ageLabel(dob: string | null, estimate: number | null, today: string): string | null {
  if (dob) {
    const [y, m, d] = dob.split("-").map(Number) as [number, number, number];
    const [ty, tm, td] = today.split("-").map(Number) as [number, number, number];
    let months = (ty - y) * 12 + (tm - m) - (td < d ? 1 : 0);
    if (months < 0) months = 0;
    return months < 24 ? `${months} month${months === 1 ? "" : "s"}` : `${Math.floor(months / 12)} years`;
  }
  return estimate !== null ? `About ${estimate} year${estimate === 1 ? "" : "s"}` : null;
}
