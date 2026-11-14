"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logger } from "@lyra/platform/logger";
import { createSupabaseServerClient } from "@lyra/platform/supabase/server";
import { requireBusiness } from "@lyra/platform/tenancy/context";
import { fieldErrors, text, type FormState } from "@/lib/form";
import { PET_COLUMNS, petSchema, toPetRow } from "./schemas";

/** Create or update a pet. All staff may edit pets (groomers keep preferences current); RLS limits it to the business. */
export async function savePetAction(slug: string, petId: string | null, customerId: string | null, _prev: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireBusiness(slug);
  const raw = Object.fromEntries(Object.keys(PET_COLUMNS).map((k) => [k, text(form, k)]));
  const parsed = petSchema.safeParse({ ...raw, species: raw.species || "dog", sex: raw.sex || "unknown" });
  if (!parsed.success) return { fields: fieldErrors(parsed.error.issues) };
  const db = await createSupabaseServerClient();
  let id = petId;
  if (id) {
    const { error } = await db.from("pets").update(toPetRow(parsed.data)).eq("id", id).eq("business_id", ctx.business.id);
    if (error) return failed("update pet", error.code, ctx.business.id);
  } else {
    if (!customerId || !z.uuid().safeParse(customerId).success) return { error: "Choose the pet's owner first." };
    const { data, error } = await db.from("pets").insert({ ...toPetRow(parsed.data), business_id: ctx.business.id, customer_id: customerId }).select("id").single();
    if (error || !data) return failed("create pet", error?.code, ctx.business.id);
    id = data.id;
  }
  revalidatePath(`/b/${slug}/pets`);
  redirect(`/b/${slug}/pets/${id}`);
}

const photoPath = (business: string, pet: string) => new RegExp(`^${business}/pets/${pet}/[0-9a-f-]{36}\\.(jpg|png|webp)$`);

/** After the browser uploads a profile photo under the business's folder, point the pet at it. */
export async function setPetPhotoAction(slug: string, petId: string, path: string): Promise<{ ok: boolean }> {
  const ctx = await requireBusiness(slug);
  if (!photoPath(ctx.business.id, petId).test(path)) return { ok: false };
  const db = await createSupabaseServerClient();
  const { error } = await db.from("pets").update({ photo_path: path }).eq("id", petId).eq("business_id", ctx.business.id);
  if (error) {
    logger.error({ code: error.code, business: ctx.business.id }, "set pet photo failed");
    return { ok: false };
  }
  revalidatePath(`/b/${slug}/pets/${petId}`);
  return { ok: true };
}

function failed(what: string, code: string | undefined, business: string): FormState {
  logger.error({ code, business }, `${what} failed`);
  return { error: "We couldn't save that. Please try again." };
}
