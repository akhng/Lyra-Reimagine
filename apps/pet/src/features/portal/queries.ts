import "server-only";
import { z } from "zod";
import { requireUser } from "@lyra/platform/auth/session";
import { createSupabaseServerClient } from "@lyra/platform/supabase/server";

/** Customer portal reads (user-scoped client; definer functions return only the caller's own records). */
const SIGNED_URL_SECONDS = 3600;

export type OwnerPet = {
  id: string; name: string; species: string; breed: string | null; size: string | null; dateOfBirth: string | null; estimatedAge: number | null; weightKg: number | null;
  coatType: string | null; groomingPreferences: string | null; careNotes: string | null; photoPath: string | null; photoUrl: string | null;
};

export async function myOwnerPets(): Promise<OwnerPet[]> {
  await requireUser();
  const db = await createSupabaseServerClient();
  const { data, error } = await db.from("owner_pets").select("*").order("created_at");
  if (error) throw new Error("owner pets query failed");
  const paths = (data ?? []).flatMap((p) => (p.photo_path ? [p.photo_path] : []));
  const signed = paths.length ? ((await db.storage.from("owner-media").createSignedUrls(paths, SIGNED_URL_SECONDS)).data ?? []) : [];
  const urls = new Map(signed.flatMap((s) => (s.path && s.signedUrl ? [[s.path, s.signedUrl] as const] : [])));
  return (data ?? []).map((p) => ({
    id: p.id, name: p.name, species: p.species, breed: p.breed, size: p.size, dateOfBirth: p.date_of_birth, estimatedAge: p.estimated_age_years === null ? null : Number(p.estimated_age_years),
    weightKg: p.weight_kg === null ? null : Number(p.weight_kg), coatType: p.coat_type, groomingPreferences: p.grooming_preferences, careNotes: p.care_notes, photoPath: p.photo_path, photoUrl: p.photo_path ? (urls.get(p.photo_path) ?? null) : null,
  }));
}

const window = z.object({ date: z.string(), part: z.enum(["morning", "afternoon", "any"]) });
const requestSchema = z.object({
  id: z.string(), status: z.string(), appointmentId: z.string().nullable(), businessName: z.string(), businessSlug: z.string(), timezone: z.string(), petName: z.string(), ownerPetId: z.string().nullable(),
  preferredStart: z.string().nullable(), windows: z.array(window), notes: z.string().nullable(), estimateCents: z.number().nullable(), estimateFrom: z.boolean(), minutes: z.number(),
  services: z.array(z.string()), appointmentStart: z.string().nullable(), groomerName: z.string().nullable(), decisionReason: z.string().nullable(), createdAt: z.string(),
  cancellationHours: z.number().nullable(), events: z.array(z.object({ status: z.string(), at: z.string(), note: z.string().nullable() })),
});
const appointmentSchema = z.object({
  id: z.string(), status: z.string(), startsAt: z.string(), minutes: z.number(), businessName: z.string(), businessSlug: z.string(), timezone: z.string(), petName: z.string(), ownerPetId: z.string().nullable(), groomerName: z.string().nullable(), services: z.array(z.string()),
});
export type MyRequest = z.infer<typeof requestSchema>;
export type MyAppointment = z.infer<typeof appointmentSchema>;

/** Links any business customer records with the person's verified email, then reads their requests and appointments. */
export async function myBookings(): Promise<{ requests: MyRequest[]; appointments: MyAppointment[] }> {
  await requireUser();
  const db = await createSupabaseServerClient();
  await db.rpc("claim_customer_records");
  // Move on requests whose time has passed, and queue reminders for the next 24 hours (both idempotent).
  const { data: open } = await db.from("booking_requests").select("business_id").in("status", ["awaiting_review", "open"]).limit(50);
  await Promise.all([...new Set((open ?? []).map((r) => r.business_id))].map((b) => db.rpc("tidy_booking_requests", { p_business: b })));
  await db.rpc("queue_my_reminders");
  const { data, error } = await db.rpc("my_bookings");
  if (error) throw new Error("bookings query failed");
  const parsed = z.object({ requests: z.array(requestSchema), appointments: z.array(appointmentSchema) }).safeParse(data);
  if (!parsed.success) throw new Error("bookings shape unexpected");
  return parsed.data;
}

const listingSummary = z.object({ slug: z.string(), name: z.string(), headline: z.string().nullable(), suburb: z.string().nullable(), mascot: z.enum(["coco", "mochi", "biscuit", "luna"]), accepting: z.boolean(), fromCents: z.number().nullable(), services: z.number() });
export type ListingSummary = z.infer<typeof listingSummary>;
const listingSchema = z.object({
  slug: z.string(), name: z.string(), timezone: z.string(), phone: z.string().nullable(), headline: z.string().nullable(), about: z.string().nullable(), mascot: z.enum(["coco", "mochi", "biscuit", "luna"]), accepting: z.boolean(),
  locations: z.array(z.object({ id: z.string(), name: z.string(), suburb: z.string().nullable() })),
  hours: z.array(z.object({ weekday: z.number(), opens: z.string(), closes: z.string() })),
  services: z.array(z.object({ id: z.string(), name: z.string(), description: z.string().nullable(), category: z.string().nullable(), minutes: z.number(), priceCents: z.number(), priceFrom: z.boolean(), sizePrices: z.record(z.string(), z.number()) })),
  policy: z.object({ cancellationHours: z.number(), text: z.string().nullable() }).nullable(),
});
export type Listing = z.infer<typeof listingSchema>;

export async function listings(): Promise<ListingSummary[]> {
  const db = await createSupabaseServerClient();
  const { data, error } = await db.rpc("marketplace_listings");
  if (error) throw new Error("listings query failed");
  return z.array(listingSummary).parse(data);
}

export async function listing(slug: string): Promise<Listing | null> {
  const db = await createSupabaseServerClient();
  const { data, error } = await db.rpc("marketplace_listing", { p_slug: slug });
  if (error) throw new Error("listing query failed");
  return data === null ? null : listingSchema.parse(data);
}

export async function myFavourites(): Promise<Set<string>> {
  await requireUser();
  const db = await createSupabaseServerClient();
  const { data } = await db.rpc("my_favourite_slugs");
  return new Set(z.array(z.string()).catch([]).parse(data));
}

/** Price for a pet's size (the salon's size price, else its base price). */
export function priceForSize(s: { priceCents: number; sizePrices: Record<string, number> }, size: string | null): number {
  return (size && s.sizePrices[size]) || s.priceCents;
}
