"use server";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { logger } from "@lyra/platform/logger";
import { createSupabaseServerClient } from "@lyra/platform/supabase/server";
import { requireBusiness } from "@lyra/platform/tenancy/context";
import { can } from "@lyra/platform/tenancy/roles";
import { fromLocal, hhmmToMinutes } from "@/features/scheduling/time";
import { processEmailOutbox } from "@/features/email/service";
import { fieldErrors, text, type FormState } from "@/lib/form";

/** Front-desk decisions on booking requests and the marketplace listing (checked again in the database). */
const REVIEW_ERRORS: Record<string, string> = {
  no_longer_available: "Someone has already dealt with this request.",
  outside_hours: "That time is outside the groomer's hours, or the salon is closed then.",
  slot_unavailable: "That groomer already has an appointment then. Choose another time or groomer.",
  outside_window: "Choose a time in the future.",
  invalid_groomer: "Choose a groomer from your team.",
  not_found: "That request isn't available.",
};

const reviewSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("confirm"), groomerId: z.uuid("Choose a groomer"), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date"), time: z.string().regex(/^\d{2}:\d{2}$/, "Choose a time") }),
  z.object({ action: z.literal("reject"), reason: z.string().trim().max(500) }),
]);

export async function reviewRequestAction(slug: string, requestId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireBusiness(slug);
  if (!can(ctx.role, "appointments.manage") || !z.uuid().safeParse(requestId).success) return { error: "Only the front desk can confirm or decline requests." };
  const parsed = reviewSchema.safeParse({ action: text(form, "action"), groomerId: text(form, "groomerId"), date: text(form, "date"), time: text(form, "time"), reason: text(form, "reason") });
  if (!parsed.success) return { fields: fieldErrors(parsed.error.issues) };
  const v = parsed.data;
  const db = await createSupabaseServerClient();
  const startsAt = v.action === "confirm" ? new Date(fromLocal(v.date, hhmmToMinutes(v.time), ctx.business.timezone)).toISOString() : null;
  const { error } = await db.rpc("review_booking_request", { p_id: requestId, p_action: v.action, p_groomer: v.action === "confirm" ? v.groomerId : null, p_starts_at: startsAt, p_reason: v.action === "reject" ? v.reason : null } as never);
  if (error) {
    if (!REVIEW_ERRORS[error.message]) logger.warn({ businessId: ctx.business.id, code: error.code }, "request review failed");
    return { error: REVIEW_ERRORS[error.message] ?? "We couldn't save that. Please try again." };
  }
  // The decline email was queued in the same transaction; send it once the response is on its way.
  if (v.action === "reject") after(() => processEmailOutbox());
  revalidatePath(`/b/${slug}/requests`);
  revalidatePath(`/b/${slug}`);
  return { ok: true };
}

const listingSchema = z.object({
  listed: z.boolean(),
  acceptingRequests: z.boolean(),
  headline: z.string().trim().max(120).transform((v) => (v === "" ? null : v)),
  about: z.string().trim().max(1500).transform((v) => (v === "" ? null : v)),
  suburb: z.string().trim().max(80).transform((v) => (v === "" ? null : v)),
  mascot: z.enum(["coco", "mochi", "biscuit", "luna"]),
});

export async function saveListingAction(slug: string, _prev: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireBusiness(slug);
  if (!can(ctx.role, "business.edit")) return { error: "Only owners and managers can change your listing." };
  const parsed = listingSchema.safeParse({ listed: form.get("listed") === "on", acceptingRequests: form.get("acceptingRequests") === "on", headline: text(form, "headline"), about: text(form, "about"), suburb: text(form, "suburb"), mascot: text(form, "mascot") || "coco" });
  if (!parsed.success) return { fields: fieldErrors(parsed.error.issues) };
  const v = parsed.data;
  const db = await createSupabaseServerClient();
  const { error } = await db.from("marketplace_profiles").upsert({ business_id: ctx.business.id, listed: v.listed, accepting_requests: v.acceptingRequests, headline: v.headline, about: v.about, suburb: v.suburb, mascot: v.mascot, updated_at: new Date().toISOString() });
  if (error) {
    logger.warn({ businessId: ctx.business.id, code: error.code }, "listing save failed");
    return { error: "We couldn't save your listing. Please try again." };
  }
  revalidatePath(`/b/${slug}/settings/listing`);
  return { ok: true };
}
