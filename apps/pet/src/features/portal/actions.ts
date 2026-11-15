"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@lyra/platform/auth/session";
import { logger } from "@lyra/platform/logger";
import { createSupabaseServerClient } from "@lyra/platform/supabase/server";
import { fieldErrors, text, type FormState } from "@/lib/form";
import { ownerPetSchema, REQUEST_ERRORS, requestSchema } from "./schemas";

/** Customer portal writes. The person comes from the session; RLS and definer functions check ownership. */
function petFromForm(form: FormData) {
  return ownerPetSchema.safeParse({
    name: text(form, "name"), species: text(form, "species") || "dog", breed: text(form, "breed"), size: text(form, "size"), dateOfBirth: text(form, "dateOfBirth"),
    estimatedAge: text(form, "estimatedAge"), weightKg: text(form, "weightKg"), coatType: text(form, "coatType"), groomingPreferences: text(form, "groomingPreferences"), careNotes: text(form, "careNotes"),
  });
}

export async function saveOwnerPetAction(petId: string | null, _prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = petFromForm(form);
  if (!parsed.success) return { fields: fieldErrors(parsed.error.issues) };
  const v = parsed.data;
  const row = { name: v.name, species: v.species, breed: v.breed, size: v.size, date_of_birth: v.dateOfBirth, estimated_age_years: v.estimatedAge, weight_kg: v.weightKg, coat_type: v.coatType, grooming_preferences: v.groomingPreferences, care_notes: v.careNotes };
  const db = await createSupabaseServerClient();
  const { data, error } = petId ? await db.from("owner_pets").update(row).eq("id", petId).select("id").single() : await db.from("owner_pets").insert({ ...row, user_id: user.id }).select("id").single();
  if (error || !data) {
    logger.warn({ code: error?.code }, "owner pet save failed");
    return { error: "We couldn't save that. Please try again." };
  }
  revalidatePath("/me");
  redirect(`/me/pets/${data.id}?saved=1`);
}

export async function setOwnerPetPhotoAction(petId: string, path: string): Promise<{ ok: boolean }> {
  const user = await requireUser();
  if (!z.uuid().safeParse(petId).success || !path.startsWith(`${user.id}/pets/${petId}/`) || path.length > 300) return { ok: false };
  const db = await createSupabaseServerClient();
  const { error } = await db.from("owner_pets").update({ photo_path: path }).eq("id", petId);
  revalidatePath("/me");
  return { ok: !error };
}

export type RequestResult = { ok: true; id: string } | { ok: false; error: string; field?: string };

export async function submitRequestAction(input: unknown): Promise<RequestResult> {
  await requireUser();
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check your request." };
  const v = parsed.data;
  const db = await createSupabaseServerClient();
  const { data, error } = await db.rpc("submit_booking_request", { p_slug: v.slug, p_owner_pet: v.ownerPetId, p_service_ids: v.serviceIds, p_preferred_start: v.preferredStart ?? undefined, p_windows: v.windows, p_notes: v.notes || undefined } as never);
  if (error || !data) {
    const msg = error?.message ?? "";
    if (!REQUEST_ERRORS[msg]) logger.warn({ code: error?.code }, "booking request failed");
    return { ok: false, error: REQUEST_ERRORS[msg] ?? "We couldn't send your request. Please try again." };
  }
  revalidatePath("/me");
  return { ok: true, id: data as unknown as string };
}

export async function cancelRequestAction(id: string, reason: string): Promise<{ ok: boolean; error?: string }> {
  await requireUser();
  if (!z.uuid().safeParse(id).success) return { ok: false };
  const db = await createSupabaseServerClient();
  const { error } = await db.rpc("cancel_booking_request", { p_id: id, p_reason: reason.slice(0, 500) });
  if (error) return { ok: false, error: REQUEST_ERRORS[error.message] ?? "We couldn't cancel that. Please try again." };
  revalidatePath("/me");
  return { ok: true };
}

export async function toggleFavouriteAction(slug: string): Promise<{ ok: boolean; favourite: boolean }> {
  await requireUser();
  const db = await createSupabaseServerClient();
  const { data, error } = await db.rpc("toggle_favourite_business", { p_slug: slug.slice(0, 60) });
  if (error) return { ok: false, favourite: false };
  revalidatePath("/me");
  return { ok: true, favourite: data === true };
}
