import { z } from "zod";

const optional = (max: number) => z.string().trim().max(max).transform((v) => (v === "" ? null : v));

export const customerSchema = z.object({
  firstName: z.string().trim().min(1, "Enter a first name").max(80),
  lastName: optional(80),
  preferredContact: z.enum(["sms", "email", "phone"]),
  preferredGroomerId: z.union([z.literal(""), z.uuid()]).transform((v) => (v === "" ? null : v)),
  notes: optional(4000),
  isVip: z.boolean(),
  marketingConsent: z.boolean(),
});

export const contactSchema = z.object({
  email: z.union([z.literal(""), z.email("Enter a valid email address").max(254)]).transform((v) => (v === "" ? null : v.toLowerCase())),
  mobile: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\+?[0-9 ]{6,20}$/.test(v), "Enter a phone number using digits and spaces")
    .transform((v) => (v === "" ? null : v)),
  addressLine: optional(200),
  suburb: optional(80),
  state: z.enum(["", "NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"]).transform((v) => (v === "" ? null : v)),
  postcode: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d{4}$/.test(v), "Postcodes have 4 digits")
    .transform((v) => (v === "" ? null : v)),
});

/** Segments shown as filters (brief §5). */
export const SEGMENTS = ["all", "new", "returning", "vip", "inactive", "due"] as const;
export type Segment = (typeof SEGMENTS)[number];

export type DirectoryRow = { id: string; first_name: string; last_name: string | null; is_vip: boolean; created_at: string; pet_names: string[]; groom_count: number; last_groomed_on: string | null; next_due_on: string | null };

/** Which segments a customer is in, from real records. `today` is the business's local date (YYYY-MM-DD). */
export function segmentsFor(row: DirectoryRow, today: string): Segment[] {
  const daysAgo = (iso: string) => Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${iso.slice(0, 10)}T00:00:00Z`)) / 86_400_000);
  const out: Segment[] = ["all"];
  if (daysAgo(row.created_at) <= 30) out.push("new");
  if (row.groom_count >= 2) out.push("returning");
  if (row.is_vip) out.push("vip");
  if (row.last_groomed_on && daysAgo(row.last_groomed_on) >= 90) out.push("inactive");
  if (row.next_due_on && row.next_due_on <= today) out.push("due");
  return out;
}
