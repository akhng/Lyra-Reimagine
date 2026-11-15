import "server-only";
import { createSupabaseServerClient } from "@lyra/platform/supabase/server";
import type { AppointmentStatus } from "./schemas";

/** Scheduling reads (user-scoped client: RLS keeps everything inside the business). */
export type CalendarAppointment = {
  id: string;
  locationId: string;
  groomerId: string;
  startsAt: string;
  serviceEndsAt: string;
  endsAt: string;
  status: AppointmentStatus;
  source: string;
  customerId: string;
  customerName: string;
  petId: string;
  petName: string;
  services: string[];
  priceCents: number | null;
  priceFrom: boolean;
  notes: string | null;
  customerNotes: string | null;
  seriesId: string | null;
  groomingRecordId: string | null;
  cancellationReason: string | null;
};

const SELECT = "id, location_id, groomer_id, starts_at, service_ends_at, ends_at, status, source, customer_id, pet_id, notes, customer_notes, price_estimate_cents, price_from, series_id, grooming_record_id, cancellation_reason, customers!inner(first_name, last_name), pets!appointments_pet_id_business_id_fkey!inner(name), appointment_services(name, position)";

type Row = {
  id: string; location_id: string; groomer_id: string; starts_at: string; service_ends_at: string; ends_at: string; status: AppointmentStatus; source: string; customer_id: string; pet_id: string;
  notes: string | null; customer_notes: string | null; price_estimate_cents: number | null; price_from: boolean; series_id: string | null; grooming_record_id: string | null; cancellation_reason: string | null;
  customers: { first_name: string; last_name: string | null }; pets: { name: string }; appointment_services: Array<{ name: string; position: number }>;
};
const toAppointment = (r: Row): CalendarAppointment => ({
  id: r.id, locationId: r.location_id, groomerId: r.groomer_id, startsAt: r.starts_at, serviceEndsAt: r.service_ends_at, endsAt: r.ends_at, status: r.status, source: r.source,
  customerId: r.customer_id, customerName: `${r.customers.first_name} ${r.customers.last_name ?? ""}`.trim(), petId: r.pet_id, petName: r.pets.name,
  services: [...r.appointment_services].sort((a, b) => a.position - b.position).map((s) => s.name), priceCents: r.price_estimate_cents, priceFrom: r.price_from,
  notes: r.notes, customerNotes: r.customer_notes, seriesId: r.series_id, groomingRecordId: r.grooming_record_id, cancellationReason: r.cancellation_reason,
});

export async function appointmentsBetween(businessId: string, fromIso: string, toIso: string, opts: { includeCancelled?: boolean } = {}): Promise<CalendarAppointment[]> {
  const db = await createSupabaseServerClient();
  let q = db.from("appointments").select(SELECT).eq("business_id", businessId).lt("starts_at", toIso).gt("ends_at", fromIso);
  if (!opts.includeCancelled) q = q.not("status", "in", "(cancelled,no_show)");
  const { data, error } = await q.order("starts_at").limit(1000);
  if (error) throw new Error("appointments query failed");
  return ((data ?? []) as unknown as Row[]).map(toAppointment);
}

export async function getAppointment(businessId: string, id: string): Promise<CalendarAppointment | null> {
  const db = await createSupabaseServerClient();
  const { data } = await db.from("appointments").select(SELECT).eq("business_id", businessId).eq("id", id).maybeSingle();
  return data ? toAppointment(data as unknown as Row) : null;
}

export async function appointmentsForPet(businessId: string, petId: string, fromIso: string): Promise<CalendarAppointment[]> {
  const db = await createSupabaseServerClient();
  const { data } = await db.from("appointments").select(SELECT).eq("business_id", businessId).eq("pet_id", petId).gte("starts_at", fromIso).not("status", "in", "(cancelled,no_show)").order("starts_at").limit(20);
  return ((data ?? []) as unknown as Row[]).map(toAppointment);
}

/** Hours, time off, closures, policy and locations for the business (staff screens and the availability engine). */
export async function schedulingSetup(businessId: string, window?: { fromIso: string; toIso: string }) {
  const db = await createSupabaseServerClient();
  const timeOff = db.from("staff_time_off").select("id, member_id, starts_at, ends_at, reason").eq("business_id", businessId).order("starts_at");
  const [locations, locationHours, staffHours, off, closures, policy] = await Promise.all([
    db.from("locations").select("id, name, timezone, is_mobile").eq("business_id", businessId).is("archived_at", null).order("created_at"),
    db.from("location_hours").select("location_id, weekday, opens, closes").eq("business_id", businessId),
    db.from("staff_hours").select("member_id, location_id, weekday, starts, ends").eq("business_id", businessId),
    window ? timeOff.lt("starts_at", window.toIso).gt("ends_at", window.fromIso) : timeOff.gte("ends_at", new Date().toISOString()).limit(200),
    db.from("business_closures").select("id, location_id, starts_on, ends_on, reason").eq("business_id", businessId).gte("ends_on", new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)).order("starts_on"),
    db.from("booking_policies").select("*").eq("business_id", businessId).maybeSingle(),
  ]);
  const t = (s: string) => s.slice(0, 5);
  return {
    locations: (locations.data ?? []).map((l) => ({ id: l.id, name: l.name, timezone: l.timezone, isMobile: l.is_mobile })),
    locationHours: (locationHours.data ?? []).map((h) => ({ locationId: h.location_id, weekday: h.weekday, opens: t(h.opens), closes: t(h.closes) })),
    staffHours: (staffHours.data ?? []).map((h) => ({ memberId: h.member_id, locationId: h.location_id, weekday: h.weekday, starts: t(h.starts), ends: t(h.ends) })),
    timeOff: (off.data ?? []).map((x) => ({ id: x.id, memberId: x.member_id, startsAt: x.starts_at, endsAt: x.ends_at, reason: x.reason })),
    closures: (closures.data ?? []).map((c) => ({ id: c.id, locationId: c.location_id, startsOn: c.starts_on, endsOn: c.ends_on, reason: c.reason })),
    policy: policy.data
      ? { onlineEnabled: policy.data.online_enabled, minNoticeMinutes: policy.data.min_notice_minutes, maxDaysAhead: policy.data.max_days_ahead, slotStepMinutes: policy.data.slot_step_minutes, cancellationHours: policy.data.cancellation_hours, policyText: policy.data.policy_text }
      : { onlineEnabled: false, minNoticeMinutes: 120, maxDaysAhead: 60, slotStepMinutes: 15, cancellationHours: 24, policyText: null },
  };
}

export async function waitlist(businessId: string) {
  const db = await createSupabaseServerClient();
  const { data, error } = await db
    .from("waitlist_entries")
    .select("id, customer_id, pet_id, service_ids, preferred_groomer_id, location_id, earliest_on, latest_on, notes, status, created_at, customers!inner(first_name, last_name), pets!inner(name)")
    .eq("business_id", businessId)
    .in("status", ["waiting", "offered"])
    .order("earliest_on")
    .limit(200);
  if (error) throw new Error("waitlist query failed");
  return data ?? [];
}
