"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logger } from "@lyra/platform/logger";
import { createSupabaseServerClient } from "@lyra/platform/supabase/server";
import { requireBusiness } from "@lyra/platform/tenancy/context";
import { fieldErrors, type FormState } from "@/lib/form";
import { groomingRecordSchema, isGroomingPhotoPath } from "./schemas";

/** Step 1: save the grooming record (any staff member). Returns its id so the browser can upload photos under it. */
export async function createGroomingRecordAction(slug: string, input: Record<string, unknown>): Promise<FormState> {
  const ctx = await requireBusiness(slug);
  const parsed = groomingRecordSchema.safeParse(input);
  if (!parsed.success) return { fields: fieldErrors(parsed.error.issues) };
  const r = parsed.data;
  const db = await createSupabaseServerClient();
  // Snapshot service names so history stays readable if a service is renamed or retired.
  const { data: services } = r.serviceIds.length ? await db.from("services").select("id, name").eq("business_id", ctx.business.id).in("id", r.serviceIds) : { data: [] };
  const names = new Map((services ?? []).map((s) => [s.id, s.name]));
  if (names.size !== r.serviceIds.length) return { fields: { serviceIds: "Choose services from your list" } };
  const summary = r.serviceIds.map((id) => names.get(id)).join(", ").slice(0, 300) || null;
  const { data, error } = await db
    .from("grooming_records")
    .insert({ business_id: ctx.business.id, pet_id: r.petId, groomed_on: r.groomedOn, groomer_id: r.groomerId, service_ids: r.serviceIds, services_summary: summary, duration_minutes: r.durationMinutes, haircut: r.haircut, shampoo: r.shampoo, customer_instructions: r.customerInstructions, observations: r.observations, customer_feedback: r.customerFeedback, created_by: ctx.userId })
    .select("id")
    .single();
  if (error || !data) {
    logger.error({ code: error?.code, business: ctx.business.id }, "create grooming record failed");
    return { error: "We couldn't save the grooming record. Please try again." };
  }
  // Recorded from an appointment: link them (Phase 3).
  const appointmentId = typeof input.appointmentId === "string" && z.uuid().safeParse(input.appointmentId).success ? input.appointmentId : null;
  if (appointmentId) await db.from("appointments").update({ grooming_record_id: data.id }).eq("business_id", ctx.business.id).eq("id", appointmentId);
  return { ok: true, id: data.id };
}

const photosSchema = z.array(z.object({ path: z.string().max(200), kind: z.enum(["before", "after"]) })).max(12);

/** Step 2: register photos the browser uploaded to the business's private folder for this record. */
export async function attachGroomingPhotosAction(slug: string, recordId: string, photos: unknown): Promise<{ ok: boolean }> {
  const ctx = await requireBusiness(slug);
  const parsed = photosSchema.safeParse(photos);
  if (!parsed.success || !z.uuid().safeParse(recordId).success) return { ok: false };
  if (!parsed.data.every((p) => isGroomingPhotoPath(p.path, ctx.business.id, recordId))) return { ok: false };
  if (parsed.data.length === 0) return { ok: true };
  const db = await createSupabaseServerClient();
  const { data: record } = await db.from("grooming_records").select("pet_id").eq("id", recordId).eq("business_id", ctx.business.id).single();
  if (!record) return { ok: false };
  const { error } = await db.from("grooming_photos").insert(parsed.data.map((p) => ({ business_id: ctx.business.id, record_id: recordId, kind: p.kind, storage_path: p.path, uploaded_by: ctx.userId })));
  if (error) {
    logger.error({ code: error.code, business: ctx.business.id }, "attach grooming photos failed");
    return { ok: false };
  }
  revalidatePath(`/b/${slug}/pets/${record.pet_id}`);
  revalidatePath(`/b/${slug}/grooming`);
  return { ok: true };
}
