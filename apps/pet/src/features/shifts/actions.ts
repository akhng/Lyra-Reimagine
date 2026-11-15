"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logger } from "@lyra/platform/logger";
import { createSupabaseServerClient } from "@lyra/platform/supabase/server";
import { requireBusiness } from "@lyra/platform/tenancy/context";
import { can } from "@lyra/platform/tenancy/roles";
import { fieldErrors, text, type FormState } from "@/lib/form";

/** Shift board and allocation actions; the database functions re-check everything. */
const ACCEPT_ERRORS: Record<string, string> = {
  no_longer_available: "Sorry, this request is no longer available. Another groomer may have accepted it.",
  not_assigned: "This request is assigned to another groomer.",
  not_capable: "This request includes a service you're not set up to do.",
  outside_hours: "That time is outside your working hours.",
  outside_window: "Choose one of the times the customer offered.",
  slot_unavailable: "You already have an appointment then.",
  not_found: "That request isn't available.",
};

export async function acceptRequestAction(slug: string, requestId: string, startsAt: string | null): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireBusiness(slug);
  if (!z.uuid().safeParse(requestId).success || (startsAt !== null && !z.iso.datetime({ offset: true }).safeParse(startsAt).success)) return { ok: false, error: "That request isn't available." };
  const db = await createSupabaseServerClient();
  const { error } = await db.rpc("accept_booking_request", { p_id: requestId, p_starts_at: startsAt } as never);
  if (error) {
    if (!ACCEPT_ERRORS[error.message]) logger.warn({ businessId: ctx.business.id, code: error.code }, "accept failed");
    revalidatePath(`/b/${slug}/shifts`);
    return { ok: false, error: ACCEPT_ERRORS[error.message] ?? "We couldn't accept that. Please try again." };
  }
  revalidatePath(`/b/${slug}/shifts`);
  revalidatePath(`/b/${slug}`);
  return { ok: true };
}

export async function openRequestAction(slug: string, requestId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireBusiness(slug);
  if (!can(ctx.role, "appointments.manage")) return { error: "Only the front desk can open requests to groomers." };
  const parsed = z.object({ groomerId: z.uuid().or(z.literal("")), hours: z.coerce.number().int().min(1).max(336) }).safeParse({ groomerId: text(form, "groomerId"), hours: text(form, "hours") || "24" });
  if (!parsed.success) return { fields: fieldErrors(parsed.error.issues) };
  const db = await createSupabaseServerClient();
  const { error } = await db.rpc("open_booking_request", { p_id: requestId, p_groomer: parsed.data.groomerId || null, p_hours: parsed.data.hours } as never);
  if (error) return { error: error.message === "not_capable" ? "That groomer isn't set up for these services." : error.message === "no_longer_available" ? "Someone has already dealt with this request." : "We couldn't open that request." };
  revalidatePath(`/b/${slug}/requests`);
  return { ok: true };
}

export async function closeRequestAction(slug: string, requestId: string): Promise<{ ok: boolean }> {
  const ctx = await requireBusiness(slug);
  if (!can(ctx.role, "appointments.manage")) return { ok: false };
  const db = await createSupabaseServerClient();
  const { error } = await db.rpc("close_booking_request", { p_id: requestId });
  revalidatePath(`/b/${slug}/requests`);
  return { ok: !error };
}

const allocationSchema = z.object({
  mode: z.enum(["manual", "open", "automatic", "assigned_only"]),
  acceptHours: z.coerce.number({ message: "Hours, e.g. 24" }).int().min(1, "At least 1 hour").max(336, "At most two weeks"),
  commission: z.string().trim().transform((v, c) => {
    if (v === "") return null;
    const n = Number(v);
    if (!Number.isInteger(n) || n < 0 || n > 100) {
      c.addIssue({ code: "custom", message: "A whole percentage from 0 to 100" });
      return z.NEVER;
    }
    return n;
  }),
  ownHours: z.boolean(),
});

export async function saveAllocationAction(slug: string, _prev: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireBusiness(slug);
  if (!can(ctx.role, "hours.manage")) return { error: "Only owners and managers can change how requests are allocated." };
  const parsed = allocationSchema.safeParse({ mode: text(form, "mode"), acceptHours: text(form, "acceptHours"), commission: text(form, "commission"), ownHours: form.get("ownHours") === "on" });
  if (!parsed.success) return { fields: fieldErrors(parsed.error.issues) };
  const v = parsed.data;
  const caps = form.getAll("cap").map(String).flatMap((c) => {
    const [member, service] = c.split(":");
    return z.uuid().safeParse(member).success && z.uuid().safeParse(service).success ? [{ business_id: ctx.business.id, member_id: member as string, service_id: service as string }] : [];
  });
  const restricted = new Set(form.getAll("restricted").map(String));
  const db = await createSupabaseServerClient();
  const { error } = await db.from("booking_policies").upsert({ business_id: ctx.business.id, allocation_mode: v.mode, accept_hours: v.acceptHours, groomer_commission_percent: v.commission, groomers_set_own_hours: v.ownHours, updated_at: new Date().toISOString() });
  if (error) {
    logger.warn({ businessId: ctx.business.id, code: error.code }, "allocation save failed");
    return { error: "We couldn't save that. Please try again." };
  }
  // Capabilities: only groomers marked "only some services" keep rows; everyone else can do everything.
  await db.from("member_services").delete().eq("business_id", ctx.business.id);
  const rows = caps.filter((c) => restricted.has(c.member_id));
  if (rows.length) await db.from("member_services").insert(rows);
  revalidatePath(`/b/${slug}/settings/allocation`);
  return { ok: true };
}

export async function saveMyHoursAction(slug: string, locationId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireBusiness(slug);
  const hours = [1, 2, 3, 4, 5, 6, 7].flatMap((d) => (form.get(`on-${d}`) === "on" ? [{ weekday: d, starts: text(form, `starts-${d}`), ends: text(form, `ends-${d}`) }] : []));
  if (hours.some((h) => !/^\d{2}:\d{2}$/.test(h.starts) || !/^\d{2}:\d{2}$/.test(h.ends) || h.starts >= h.ends)) return { error: "Each working day needs a start before its finish." };
  const db = await createSupabaseServerClient();
  const { error } = await db.rpc("save_my_hours", { p_business: ctx.business.id, p_location: locationId, p_hours: hours });
  if (error) return { error: error.message === "not_allowed" ? "Your business sets team hours centrally." : "We couldn't save your hours." };
  revalidatePath(`/b/${slug}/shifts`);
  return { ok: true };
}
