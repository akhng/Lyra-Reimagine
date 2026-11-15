"use server";
import { revalidatePath } from "next/cache";
import { logger } from "@lyra/platform/logger";
import { createSupabaseServerClient } from "@lyra/platform/supabase/server";
import { requireBusiness } from "@lyra/platform/tenancy/context";
import { can } from "@lyra/platform/tenancy/roles";
import { fieldErrors } from "@/lib/form";
import { estimatePrice } from "../services/pricing";
import { addDays, fromLocal, hhmmToMinutes, toLocal } from "./time";
import * as s from "./schemas";

export type ScheduleResult = { ok?: boolean; error?: string; fields?: Record<string, string>; id?: string; skipped?: string[] };
const CLASH = "That time clashes with another appointment for this groomer.";
const FORBIDDEN = "Only owners, managers and reception can do that.";
const failed = (what: string, code: string | undefined, business: string): ScheduleResult => {
  logger.error({ code, business }, `${what} failed`);
  return { error: "We couldn't save that. Please try again." };
};
const refresh = (slug: string) => {
  revalidatePath(`/b/${slug}/calendar`);
  revalidatePath(`/b/${slug}`);
};

async function zoneFor(db: Awaited<ReturnType<typeof createSupabaseServerClient>>, businessId: string, locationId: string, fallback: string) {
  const { data } = await db.from("locations").select("timezone").eq("id", locationId).eq("business_id", businessId).maybeSingle();
  return data?.timezone ?? fallback;
}

/** Book an appointment (optionally repeating every N weeks). Repeats that clash are skipped and reported. */
export async function createAppointmentAction(slug: string, input: unknown): Promise<ScheduleResult> {
  const ctx = await requireBusiness(slug);
  if (!can(ctx.role, "appointments.manage")) return { error: FORBIDDEN };
  const p = s.appointmentSchema.safeParse(input);
  if (!p.success) return { fields: fieldErrors(p.error.issues) };
  const a = p.data;
  const db = await createSupabaseServerClient();
  const [{ data: services }, { data: pet }] = await Promise.all([
    db.from("services").select("id, name, duration_minutes, buffer_minutes, base_price_cents, price_from, position, service_price_rules(kind, match_value, price_cents)").eq("business_id", ctx.business.id).in("id", a.serviceIds),
    db.from("pets").select("id, customer_id, size, breed").eq("business_id", ctx.business.id).eq("id", a.petId).maybeSingle(),
  ]);
  if (!services || services.length !== a.serviceIds.length) return { fields: { serviceIds: "Choose services from your list" } };
  if (!pet || pet.customer_id !== a.customerId) return { fields: { petId: "Choose one of this customer's pets" } };
  const priced = services.map((sv) => ({ sv, est: estimatePrice({ basePriceCents: sv.base_price_cents, priceFrom: sv.price_from, rules: sv.service_price_rules.map((r) => ({ kind: r.kind, matchValue: r.match_value, priceCents: r.price_cents })) }, { size: pet.size, breed: pet.breed }, a.coatConditions) }));
  const minutes = services.reduce((n, sv) => n + sv.duration_minutes, 0);
  const buffer = services.reduce((n, sv) => Math.max(n, sv.buffer_minutes), 0);
  const total = priced.reduce((n, x) => n + x.est.totalCents, 0);
  const from = priced.some((x) => x.est.from);
  const tz = await zoneFor(db, ctx.business.id, a.locationId, ctx.business.timezone);
  const repeats = a.repeatWeeks > 0 ? Math.max(1, a.occurrences) : 1;
  let seriesId: string | null = null;
  if (repeats > 1) {
    const { data: series, error } = await db.from("appointment_series").insert({ business_id: ctx.business.id, interval_weeks: a.repeatWeeks, occurrences: repeats }).select("id").single();
    if (error || !series) return failed("create series", error?.code, ctx.business.id);
    seriesId = series.id;
  }
  let firstId: string | undefined;
  const skipped: string[] = [];
  for (let i = 0; i < repeats; i++) {
    const date = addDays(a.date, i * a.repeatWeeks * 7);
    const start = fromLocal(date, hhmmToMinutes(a.time), tz);
    const row = {
      business_id: ctx.business.id, location_id: a.locationId, customer_id: a.customerId, pet_id: a.petId, groomer_id: a.groomerId,
      starts_at: new Date(start).toISOString(), service_ends_at: new Date(start + minutes * 60_000).toISOString(), ends_at: new Date(start + (minutes + buffer) * 60_000).toISOString(),
      notes: a.notes, price_estimate_cents: total, price_from: from, series_id: seriesId, source: "staff",
    };
    const { data, error } = await db.from("appointments").insert(row).select("id").single();
    if (error?.code === "23P01") {
      if (i === 0 && repeats === 1) return { error: CLASH };
      skipped.push(date);
      continue;
    }
    if (error || !data) return failed("create appointment", error?.code, ctx.business.id);
    firstId ??= data.id;
    const { error: se } = await db.from("appointment_services").insert(priced.map(({ sv, est }, idx) => ({ business_id: ctx.business.id, appointment_id: data.id, service_id: sv.id, name: sv.name, duration_minutes: sv.duration_minutes, price_cents: est.totalCents, position: idx })));
    if (se) return failed("save appointment services", se.code, ctx.business.id);
  }
  if (!firstId) return { error: "Every date clashes with another appointment for this groomer.", skipped };
  refresh(slug);
  return { ok: true, id: firstId, skipped };
}

async function moveTo(slug: string, id: string, startMs: number, groomerId: string): Promise<ScheduleResult> {
  const ctx = await requireBusiness(slug);
  if (!can(ctx.role, "appointments.manage")) return { error: FORBIDDEN };
  const db = await createSupabaseServerClient();
  const { data: a } = await db.from("appointments").select("starts_at, service_ends_at, ends_at, status").eq("business_id", ctx.business.id).eq("id", id).maybeSingle();
  if (!a) return { error: "That appointment isn't available." };
  if (a.status === "cancelled" || a.status === "completed" || a.status === "no_show") return { error: "Finished or cancelled appointments can't be moved." };
  const service = Date.parse(a.service_ends_at) - Date.parse(a.starts_at);
  const block = Date.parse(a.ends_at) - Date.parse(a.starts_at);
  const { error } = await db.from("appointments").update({ starts_at: new Date(startMs).toISOString(), service_ends_at: new Date(startMs + service).toISOString(), ends_at: new Date(startMs + block).toISOString(), groomer_id: groomerId }).eq("business_id", ctx.business.id).eq("id", id);
  if (error?.code === "23P01") return { error: CLASH };
  if (error) return failed("move appointment", error.code, ctx.business.id);
  refresh(slug);
  revalidatePath(`/b/${slug}/appointments/${id}`);
  return { ok: true, id };
}

export async function rescheduleAppointmentAction(slug: string, input: unknown): Promise<ScheduleResult> {
  const p = s.rescheduleSchema.safeParse(input);
  if (!p.success) return { fields: fieldErrors(p.error.issues) };
  const ctx = await requireBusiness(slug);
  const db = await createSupabaseServerClient();
  const { data: a } = await db.from("appointments").select("location_id").eq("business_id", ctx.business.id).eq("id", p.data.id).maybeSingle();
  if (!a) return { error: "That appointment isn't available." };
  const tz = await zoneFor(db, ctx.business.id, a.location_id, ctx.business.timezone);
  return moveTo(slug, p.data.id, fromLocal(p.data.date, hhmmToMinutes(p.data.time), tz), p.data.groomerId);
}

/** Drag-and-drop on the calendar. */
export async function moveAppointmentAction(slug: string, input: unknown): Promise<ScheduleResult> {
  const p = s.moveSchema.safeParse(input);
  if (!p.success) return { error: "That move isn't valid." };
  return moveTo(slug, p.data.id, Date.parse(p.data.startsAt), p.data.groomerId);
}

export async function setAppointmentStatusAction(slug: string, input: unknown): Promise<ScheduleResult> {
  const ctx = await requireBusiness(slug);
  const p = s.statusSchema.safeParse(input);
  if (!p.success) return { error: "That status isn't valid." };
  if (p.data.status === "cancelled" && !p.data.reason) return { fields: { reason: "Say why it's cancelled" } };
  const db = await createSupabaseServerClient();
  const { error } = await db.rpc("set_appointment_status", { p_id: p.data.id, p_status: p.data.status, p_reason: p.data.reason ?? undefined });
  if (error?.code === "42501") return { error: "You can only update your own appointments." };
  if (error) return failed("set appointment status", error.code, ctx.business.id);
  refresh(slug);
  revalidatePath(`/b/${slug}/appointments/${p.data.id}`);
  return { ok: true, id: p.data.id };
}

export async function updateAppointmentNotesAction(slug: string, input: unknown): Promise<ScheduleResult> {
  const ctx = await requireBusiness(slug);
  if (!can(ctx.role, "appointments.manage")) return { error: FORBIDDEN };
  const p = s.notesSchema.safeParse(input);
  if (!p.success) return { fields: fieldErrors(p.error.issues) };
  const db = await createSupabaseServerClient();
  const { error } = await db.from("appointments").update({ notes: p.data.notes }).eq("business_id", ctx.business.id).eq("id", p.data.id);
  if (error) return failed("update notes", error.code, ctx.business.id);
  revalidatePath(`/b/${slug}/appointments/${p.data.id}`);
  return { ok: true };
}

/** Link a grooming record to the appointment it came from (Record groom from an appointment). */
export async function linkGroomingRecord(slug: string, appointmentId: string, recordId: string): Promise<void> {
  const ctx = await requireBusiness(slug);
  const db = await createSupabaseServerClient();
  // Front desk can link directly; for groomers RLS refuses and the record still stands on its own.
  await db.from("appointments").update({ grooming_record_id: recordId }).eq("business_id", ctx.business.id).eq("id", appointmentId);
}

// ---------------------------------------------------------------- hours & policy (owner, manager)
async function hoursCtx(slug: string) {
  const ctx = await requireBusiness(slug);
  return can(ctx.role, "hours.manage") ? ctx : null;
}

export async function saveLocationHoursAction(slug: string, input: unknown): Promise<ScheduleResult> {
  const ctx = await hoursCtx(slug);
  if (!ctx) return { error: "Only owners and managers can change opening hours." };
  const p = s.locationHoursSchema.safeParse(input);
  if (!p.success) return { error: p.error.issues[0]?.message ?? "Check the hours." };
  const db = await createSupabaseServerClient();
  const { error: de } = await db.from("location_hours").delete().eq("business_id", ctx.business.id).eq("location_id", p.data.locationId);
  if (de) return failed("clear location hours", de.code, ctx.business.id);
  if (p.data.hours.length) {
    const { error } = await db.from("location_hours").insert(p.data.hours.map((h) => ({ business_id: ctx.business.id, location_id: p.data.locationId, ...h })));
    if (error) return failed("save location hours", error.code, ctx.business.id);
  }
  revalidatePath(`/b/${slug}/settings/hours`);
  return { ok: true };
}

export async function saveStaffHoursAction(slug: string, input: unknown): Promise<ScheduleResult> {
  const ctx = await hoursCtx(slug);
  if (!ctx) return { error: "Only owners and managers can change staff hours." };
  const p = s.staffHoursSchema.safeParse(input);
  if (!p.success) return { error: p.error.issues[0]?.message ?? "Check the hours." };
  const db = await createSupabaseServerClient();
  const { error: de } = await db.from("staff_hours").delete().eq("business_id", ctx.business.id).eq("member_id", p.data.memberId);
  if (de) return failed("clear staff hours", de.code, ctx.business.id);
  if (p.data.hours.length) {
    const { error } = await db.from("staff_hours").insert(p.data.hours.map((h) => ({ business_id: ctx.business.id, member_id: p.data.memberId, location_id: h.locationId, weekday: h.weekday, starts: h.starts, ends: h.ends })));
    if (error) return failed("save staff hours", error.code, ctx.business.id);
  }
  revalidatePath(`/b/${slug}/settings/hours`);
  return { ok: true };
}

export async function addTimeOffAction(slug: string, input: unknown): Promise<ScheduleResult> {
  const ctx = await hoursCtx(slug);
  if (!ctx) return { error: "Only owners and managers can add time off." };
  const p = s.timeOffSchema.safeParse(input);
  if (!p.success) return { fields: fieldErrors(p.error.issues) };
  const v = p.data;
  const db = await createSupabaseServerClient();
  const tz = ctx.business.timezone;
  const { error } = await db.from("staff_time_off").insert({ business_id: ctx.business.id, member_id: v.memberId, starts_at: new Date(fromLocal(v.startDate, hhmmToMinutes(v.startTime), tz)).toISOString(), ends_at: new Date(fromLocal(v.endDate, hhmmToMinutes(v.endTime), tz)).toISOString(), reason: v.reason });
  if (error) return failed("add time off", error.code, ctx.business.id);
  revalidatePath(`/b/${slug}/settings/hours`);
  refresh(slug);
  return { ok: true };
}

export async function deleteTimeOffAction(slug: string, id: string): Promise<ScheduleResult> {
  const ctx = await hoursCtx(slug);
  if (!ctx) return { error: "Only owners and managers can remove time off." };
  const db = await createSupabaseServerClient();
  const { error } = await db.from("staff_time_off").delete().eq("business_id", ctx.business.id).eq("id", id);
  if (error) return failed("delete time off", error.code, ctx.business.id);
  revalidatePath(`/b/${slug}/settings/hours`);
  return { ok: true };
}

export async function addClosureAction(slug: string, input: unknown): Promise<ScheduleResult> {
  const ctx = await hoursCtx(slug);
  if (!ctx) return { error: "Only owners and managers can add closures." };
  const p = s.closureSchema.safeParse(input);
  if (!p.success) return { fields: fieldErrors(p.error.issues) };
  const db = await createSupabaseServerClient();
  const { error } = await db.from("business_closures").insert({ business_id: ctx.business.id, location_id: p.data.locationId, starts_on: p.data.startsOn, ends_on: p.data.endsOn, reason: p.data.reason });
  if (error) return failed("add closure", error.code, ctx.business.id);
  revalidatePath(`/b/${slug}/settings/hours`);
  return { ok: true };
}

export async function deleteClosureAction(slug: string, id: string): Promise<ScheduleResult> {
  const ctx = await hoursCtx(slug);
  if (!ctx) return { error: "Only owners and managers can remove closures." };
  const db = await createSupabaseServerClient();
  const { error } = await db.from("business_closures").delete().eq("business_id", ctx.business.id).eq("id", id);
  if (error) return failed("delete closure", error.code, ctx.business.id);
  revalidatePath(`/b/${slug}/settings/hours`);
  return { ok: true };
}

export async function savePolicyAction(slug: string, input: unknown): Promise<ScheduleResult> {
  const ctx = await hoursCtx(slug);
  if (!ctx) return { error: "Only owners and managers can change online booking." };
  const p = s.policySchema.safeParse(input);
  if (!p.success) return { fields: fieldErrors(p.error.issues) };
  const v = p.data;
  const db = await createSupabaseServerClient();
  const { error } = await db.from("booking_policies").upsert({ business_id: ctx.business.id, online_enabled: v.onlineEnabled, min_notice_minutes: v.minNoticeMinutes, max_days_ahead: v.maxDaysAhead, slot_step_minutes: v.slotStepMinutes, cancellation_hours: v.cancellationHours, policy_text: v.policyText });
  if (error) return failed("save booking policy", error.code, ctx.business.id);
  revalidatePath(`/b/${slug}/settings/hours`);
  return { ok: true };
}

// ---------------------------------------------------------------- waitlist (front desk)
export async function addWaitlistAction(slug: string, input: unknown): Promise<ScheduleResult> {
  const ctx = await requireBusiness(slug);
  if (!can(ctx.role, "appointments.manage")) return { error: FORBIDDEN };
  const p = s.waitlistSchema.safeParse(input);
  if (!p.success) return { fields: fieldErrors(p.error.issues) };
  const v = p.data;
  const db = await createSupabaseServerClient();
  const { error } = await db.from("waitlist_entries").insert({ business_id: ctx.business.id, customer_id: v.customerId, pet_id: v.petId, service_ids: v.serviceIds, preferred_groomer_id: v.preferredGroomerId, earliest_on: v.earliestOn, latest_on: v.latestOn, notes: v.notes });
  if (error?.code === "23503") return { fields: { petId: "Choose one of this customer's pets" } };
  if (error) return failed("add waitlist", error.code, ctx.business.id);
  revalidatePath(`/b/${slug}/waitlist`);
  return { ok: true };
}

export async function setWaitlistStatusAction(slug: string, input: unknown): Promise<ScheduleResult> {
  const ctx = await requireBusiness(slug);
  if (!can(ctx.role, "appointments.manage")) return { error: FORBIDDEN };
  const p = s.waitlistStatusSchema.safeParse(input);
  if (!p.success) return { error: "That status isn't valid." };
  const db = await createSupabaseServerClient();
  const { error } = await db.from("waitlist_entries").update({ status: p.data.status }).eq("business_id", ctx.business.id).eq("id", p.data.id);
  if (error) return failed("update waitlist", error.code, ctx.business.id);
  revalidatePath(`/b/${slug}/waitlist`);
  return { ok: true };
}

/** Today's date in the business's zone (for forms). */
export async function businessToday(slug: string): Promise<string> {
  const ctx = await requireBusiness(slug);
  return toLocal(Date.now(), ctx.business.timezone).date;
}

/**
 * Free start times for the booking form (staff view): the availability
 * engine over that groomer's hours and appointments. Staff may still pick
 * another time; only overlaps are refused.
 */
export async function freeTimesAction(slug: string, input: { locationId: string; groomerId: string; date: string; serviceIds: string[] }): Promise<string[]> {
  const ctx = await requireBusiness(slug);
  const ok = /^\d{4}-\d{2}-\d{2}$/.test(input.date) && [input.locationId, input.groomerId, ...input.serviceIds].every((x) => /^[0-9a-f-]{36}$/.test(x));
  if (!ok || input.serviceIds.length === 0) return [];
  const db = await createSupabaseServerClient();
  const tz = await zoneFor(db, ctx.business.id, input.locationId, ctx.business.timezone);
  const from = new Date(fromLocal(input.date, 0, tz) - 86_400_000).toISOString();
  const to = new Date(fromLocal(input.date, 0, tz) + 2 * 86_400_000).toISOString();
  const [{ data: services }, { data: hours }, { data: staff }, { data: busy }, { data: off }, { data: closures }] = await Promise.all([
    db.from("services").select("duration_minutes, buffer_minutes").eq("business_id", ctx.business.id).in("id", input.serviceIds),
    db.from("location_hours").select("weekday, opens, closes").eq("location_id", input.locationId),
    db.from("staff_hours").select("member_id, location_id, weekday, starts, ends").eq("member_id", input.groomerId),
    db.from("appointments").select("groomer_id, starts_at, ends_at").eq("groomer_id", input.groomerId).not("status", "in", "(cancelled,no_show)").lt("starts_at", to).gt("ends_at", from),
    db.from("staff_time_off").select("member_id, starts_at, ends_at").eq("member_id", input.groomerId).lt("starts_at", to).gt("ends_at", from),
    db.from("business_closures").select("location_id, starts_on, ends_on").eq("business_id", ctx.business.id).lte("starts_on", input.date).gte("ends_on", input.date),
  ]);
  const { availability, blockFor } = await import("./availability");
  const block = blockFor((services ?? []).map((sv) => ({ durationMinutes: sv.duration_minutes, bufferMinutes: sv.buffer_minutes })));
  const t = (x: string) => x.slice(0, 5);
  const days = availability({
    timeZone: tz,
    locationId: input.locationId,
    locationHours: (hours ?? []).map((h) => ({ weekday: h.weekday, opens: t(h.opens), closes: t(h.closes) })),
    staffHours: (staff ?? []).map((h) => ({ memberId: h.member_id, locationId: h.location_id, weekday: h.weekday, starts: t(h.starts), ends: t(h.ends) })),
    busy: [...(busy ?? []).map((b) => ({ memberId: b.groomer_id, startsAt: b.starts_at, endsAt: b.ends_at })), ...(off ?? []).map((b) => ({ memberId: b.member_id, startsAt: b.starts_at, endsAt: b.ends_at }))],
    closures: (closures ?? []).map((c) => ({ locationId: c.location_id, startsOn: c.starts_on, endsOn: c.ends_on })),
    policy: { minNoticeMinutes: 0, maxDaysAhead: 400, slotStepMinutes: 15 },
    ...block,
    groomerId: input.groomerId,
    from: input.date,
    to: input.date,
    now: new Date(),
  });
  return (days[0]?.slots ?? []).map((sl) => `${String(Math.floor(sl.localMinutes / 60)).padStart(2, "0")}:${String(sl.localMinutes % 60).padStart(2, "0")}`);
}
