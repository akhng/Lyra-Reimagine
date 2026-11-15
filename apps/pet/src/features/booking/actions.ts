"use server";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { logger } from "@lyra/platform/logger";
import { createSupabaseServerClient } from "@lyra/platform/supabase/server";
import { fieldErrors } from "@/lib/form";
import { BOOKING_ERRORS, bookingInputSchema } from "./schemas";

export type BookingResult = { error?: string; fields?: Record<string, string> };
const MIN_FILL_MS = 4_000;

/** A short, salted hash of the client's address for rate limiting (never stored raw). */
async function clientHash(slug: string): Promise<string | null> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? "").split(",")[0]?.trim();
  if (!ip) return null;
  return createHash("sha256").update(`${ip}|${slug}|${new Date().toISOString().slice(0, 10)}`).digest("hex").slice(0, 32);
}

function message(code: string | undefined, raw: string | undefined): string {
  return BOOKING_ERRORS[raw ?? ""] ?? (code === "22023" ? "Please check your details." : "We couldn't make the booking. Please try again.");
}

/** Public booking (anonymous). Everything is re-checked by create_online_booking(). */
export async function bookOnlineAction(slug: string, input: unknown): Promise<BookingResult> {
  const p = bookingInputSchema.safeParse(input);
  if (!p.success) return { fields: fieldErrors(p.error.issues) };
  const v = p.data;
  // Bots fill hidden fields and submit instantly: pretend nothing is wrong, book nothing.
  if (v.website || Date.now() - v.openedAt < MIN_FILL_MS) return { error: "Please take a moment to check your details, then try again." };
  const db = await createSupabaseServerClient();
  const { data, error } = await db.rpc("create_online_booking", {
    p_slug: slug,
    p_location: v.locationId,
    // null means "any groomer" (the generated type omits nullability for this parameter).
    p_groomer: v.groomerId as string,
    p_service_ids: v.serviceIds,
    p_starts_at: v.startsAt,
    p_customer: { firstName: v.firstName, lastName: v.lastName, email: v.email, mobile: v.mobile, marketingConsent: v.marketingConsent },
    p_pet: { name: v.petName, species: v.species, size: v.size, breed: v.breed },
    p_notes: v.notes || undefined,
    p_client_hash: (await clientHash(slug)) ?? undefined,
  });
  const token = (data as { token?: string } | null)?.token;
  if (error || !token) {
    logger.warn({ code: error?.code, reason: error?.message }, "online booking refused");
    return { error: message(error?.code, error?.message) };
  }
  redirect(`/book/manage/${token}?booked=1`);
}

export async function cancelByTokenAction(token: string): Promise<BookingResult> {
  if (!/^[0-9a-f]{48}$/.test(token)) return { error: BOOKING_ERRORS.not_found };
  const db = await createSupabaseServerClient();
  const { error } = await db.rpc("cancel_booking_by_token", { p_token: token });
  if (error) return { error: message(error.code, error.message) };
  redirect(`/book/manage/${token}?cancelled=1`);
}

export async function rescheduleByTokenAction(token: string, startsAt: string, groomerId: string | null): Promise<BookingResult> {
  if (!/^[0-9a-f]{48}$/.test(token) || Number.isNaN(Date.parse(startsAt))) return { error: BOOKING_ERRORS.not_found };
  const db = await createSupabaseServerClient();
  const { error } = await db.rpc("reschedule_booking_by_token", { p_token: token, p_starts_at: startsAt, p_groomer: groomerId ?? undefined });
  if (error) return { error: message(error.code, error.message) };
  redirect(`/book/manage/${token}?moved=1`);
}
