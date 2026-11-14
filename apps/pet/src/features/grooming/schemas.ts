import { z } from "zod";

const optional = (max: number) => z.string().trim().max(max).transform((v) => (v === "" ? null : v));

export const groomingRecordSchema = z.object({
  petId: z.uuid(),
  groomedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the date"),
  groomerId: z.union([z.literal(""), z.uuid()]).transform((v) => (v === "" ? null : v)),
  serviceIds: z.array(z.uuid()).max(10).transform((ids) => [...new Set(ids)]),
  durationMinutes: z
    .string()
    .trim()
    .refine((v) => v === "" || (/^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 720), "Minutes between 1 and 720")
    .transform((v) => (v === "" ? null : Number(v))),
  haircut: optional(300),
  shampoo: optional(120),
  customerInstructions: optional(2000),
  observations: optional(2000),
  customerFeedback: optional(2000),
});

export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

/** A grooming photo path must sit under this business and record: <business>/grooming/<record>/<uuid>.<ext>. */
export function isGroomingPhotoPath(path: string, businessId: string, recordId: string): boolean {
  return new RegExp(`^${businessId}/grooming/${recordId}/[0-9a-f-]{36}\\.(jpg|png|webp)$`).test(path);
}
