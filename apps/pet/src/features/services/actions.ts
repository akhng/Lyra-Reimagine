"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logger } from "@lyra/platform/logger";
import { createSupabaseServerClient } from "@lyra/platform/supabase/server";
import { requireBusiness } from "@lyra/platform/tenancy/context";
import { can } from "@lyra/platform/tenancy/roles";
import { fieldErrors, text, type FormState } from "@/lib/form";
import { COAT_CONDITIONS, PET_SIZES, parseAudToCents } from "./pricing";

const money = (label: string) =>
  z.string().transform((v, ctx) => {
    const cents = parseAudToCents(v);
    if (cents === null) {
      ctx.addIssue({ code: "custom", message: `Enter ${label} in dollars, e.g. 85 or 85.50` });
      return z.NEVER;
    }
    return cents;
  });

const serviceSchema = z.object({
  name: z.string().trim().min(1, "Name the service").max(80),
  description: z.string().trim().max(1000).transform((v) => (v === "" ? null : v)),
  category: z.string().trim().max(60).transform((v) => (v === "" ? null : v)),
  durationMinutes: z.coerce.number({ message: "Minutes, e.g. 60" }).int().min(5, "At least 5 minutes").max(600),
  bufferMinutes: z.coerce.number().int().min(0).max(120),
  basePrice: money("a price"),
  priceFrom: z.boolean(),
  bookableOnline: z.boolean(),
  active: z.boolean(),
});

/** Create or update a service and its price rules (owner, manager). Blank rule fields are removed. */
export async function saveServiceAction(slug: string, serviceId: string | null, _prev: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireBusiness(slug);
  if (!can(ctx.role, "business.edit")) return { error: "Only owners and managers can change services and prices." };
  const parsed = serviceSchema.safeParse({ name: text(form, "name"), description: text(form, "description"), category: text(form, "category"), durationMinutes: text(form, "durationMinutes"), bufferMinutes: text(form, "bufferMinutes") || "0", basePrice: text(form, "basePrice"), priceFrom: form.get("priceFrom") === "on", bookableOnline: form.get("bookableOnline") === "on", active: serviceId ? form.get("active") === "on" : true });
  const rules: Array<{ kind: "size" | "breed" | "coat_condition"; match_value: string; price_cents: number }> = [];
  const ruleErrors: Record<string, string> = {};
  for (const size of PET_SIZES) {
    const v = text(form, `size_${size}`);
    if (!v) continue;
    const cents = parseAudToCents(v);
    if (cents === null) ruleErrors[`size_${size}`] = "Dollars, e.g. 95";
    else rules.push({ kind: "size", match_value: size, price_cents: cents });
  }
  for (const c of COAT_CONDITIONS) {
    const v = text(form, `coat_${c}`);
    if (!v) continue;
    const cents = parseAudToCents(v);
    if (cents === null) ruleErrors[`coat_${c}`] = "Dollars, e.g. 25";
    else rules.push({ kind: "coat_condition", match_value: c, price_cents: cents });
  }
  for (const line of text(form, "breedPrices").split("\n").map((l) => l.trim()).filter(Boolean)) {
    const m = /^(.{1,80}?)\s*[:=]\s*\$?([\d.,]+)$/.exec(line);
    const cents = m ? parseAudToCents(m[2]!) : null; // groups exist when m matched
    if (!m || cents === null) ruleErrors.breedPrices = `Couldn't read “${line.slice(0, 40)}”. Use one breed per line, like “Golden Retriever: 130”.`;
    else rules.push({ kind: "breed", match_value: m[1]!.trim(), price_cents: cents }); // m matched
  }
  if (!parsed.success || Object.keys(ruleErrors).length) return { fields: { ...(parsed.success ? {} : fieldErrors(parsed.error.issues)), ...ruleErrors } };
  const s = parsed.data;
  const row = { name: s.name, description: s.description, category: s.category, duration_minutes: s.durationMinutes, buffer_minutes: s.bufferMinutes, base_price_cents: s.basePrice, price_from: s.priceFrom, bookable_online: s.bookableOnline, active: s.active };
  const db = await createSupabaseServerClient();
  let id = serviceId;
  if (id) {
    const { error } = await db.from("services").update(row).eq("id", id).eq("business_id", ctx.business.id);
    if (error) return failed(error.code, ctx.business.id);
    const { error: de } = await db.from("service_price_rules").delete().eq("service_id", id).eq("business_id", ctx.business.id);
    if (de) return failed(de.code, ctx.business.id);
  } else {
    const { data, error } = await db.from("services").insert({ ...row, business_id: ctx.business.id }).select("id").single();
    if (error || !data) return failed(error?.code, ctx.business.id);
    id = data.id;
  }
  if (rules.length) {
    const { error } = await db.from("service_price_rules").insert(rules.map((r) => ({ ...r, business_id: ctx.business.id, service_id: id! }))); // id set above
    if (error) return failed(error.code, ctx.business.id);
  }
  revalidatePath(`/b/${slug}/services`);
  return { ok: true, id: id ?? undefined };
}

function failed(code: string | undefined, business: string): FormState {
  logger.error({ code, business }, "save service failed");
  return { error: "We couldn't save the service. Please try again." };
}
