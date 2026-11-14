"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@lyra/platform/auth/session";
import { logger } from "@lyra/platform/logger";
import { createSupabaseServerClient } from "@lyra/platform/supabase/server";
import { requireBusiness } from "@lyra/platform/tenancy/context";
import { can } from "@lyra/platform/tenancy/roles";
import { businessDetailsSchema, createBusinessSchema, locationSchema } from "./schemas";

export type FormState = { ok?: boolean; error?: string; fields?: Record<string, string> } | undefined;
const fieldErrors = (issues: Array<{ path: PropertyKey[]; message: string }>) => Object.fromEntries(issues.map((i) => [String(i.path[0]), i.message]));

export async function createBusinessAction(_prev: FormState, form: FormData): Promise<FormState> {
  await requireUser();
  const parsed = createBusinessSchema.safeParse({ name: form.get("name"), slug: form.get("slug"), timezone: form.get("timezone"), locationName: form.get("locationName") ?? undefined });
  if (!parsed.success) return { fields: fieldErrors(parsed.error.issues) };
  const db = await createSupabaseServerClient();
  const { error } = await db.rpc("create_business", { p_name: parsed.data.name, p_slug: parsed.data.slug, p_timezone: parsed.data.timezone, p_location_name: parsed.data.locationName ?? undefined });
  if (error) {
    if (/slug_taken/.test(error.message)) return { fields: { slug: "That booking link is taken — try another" } };
    if (/limit_reached/.test(error.message)) return { error: "You've reached the number of businesses one account can create. Contact support to add more." };
    logger.error({ code: error.code }, "create_business failed");
    return { error: "We couldn't create your business. Please try again." };
  }
  redirect(`/b/${parsed.data.slug}`);
}

export async function updateBusinessAction(slug: string, _prev: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireBusiness(slug);
  if (!can(ctx.role, "business.edit")) return { error: "Only owners and managers can change business details." };
  const parsed = businessDetailsSchema.safeParse({ name: form.get("name"), timezone: form.get("timezone"), abn: form.get("abn") ?? "", gstRegistered: form.get("gstRegistered") === "on", phone: form.get("phone") ?? "", email: form.get("email") ?? "" });
  if (!parsed.success) return { fields: fieldErrors(parsed.error.issues) };
  const d = parsed.data;
  const db = await createSupabaseServerClient();
  // RLS also enforces the role; this keeps the message friendly.
  const { error } = await db.from("businesses").update({ name: d.name, timezone: d.timezone, abn: d.abn, gst_registered: d.gstRegistered, phone: d.phone, email: d.email }).eq("id", ctx.business.id);
  if (error) {
    logger.error({ code: error.code, business: ctx.business.id }, "update business failed");
    return { error: "We couldn't save your changes. Please try again." };
  }
  revalidatePath(`/b/${slug}`, "layout");
  return { ok: true };
}

export async function saveLocationAction(slug: string, _prev: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireBusiness(slug);
  if (!can(ctx.role, "locations.manage")) return { error: "Only owners and managers can change locations." };
  const parsed = locationSchema.safeParse({ id: form.get("id") || undefined, name: form.get("name"), addressLine: form.get("addressLine") ?? "", suburb: form.get("suburb") ?? "", state: form.get("state") ?? "", postcode: form.get("postcode") ?? "", isMobile: form.get("isMobile") === "on" });
  if (!parsed.success) return { fields: fieldErrors(parsed.error.issues) };
  const d = parsed.data;
  const row = { name: d.name, address_line: d.addressLine, suburb: d.suburb, state: d.state, postcode: d.postcode, is_mobile: d.isMobile };
  const db = await createSupabaseServerClient();
  const { error } = d.id ? await db.from("locations").update(row).eq("id", d.id).eq("business_id", ctx.business.id) : await db.from("locations").insert({ ...row, business_id: ctx.business.id });
  if (error) {
    logger.error({ code: error.code, business: ctx.business.id }, "save location failed");
    return { error: "We couldn't save the location. Please try again." };
  }
  revalidatePath(`/b/${slug}/settings`);
  return { ok: true };
}
