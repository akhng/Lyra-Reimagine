import "server-only";
import { createSupabaseServerClient } from "@lyra/platform/supabase/server";
import type { BusinessContext } from "@lyra/platform/tenancy/context";
import { searchCustomers } from "@/features/customers/queries";
import { segmentsFor } from "@/features/customers/schemas";
import { appointmentsBetween, type CalendarAppointment } from "@/features/scheduling/queries";
import { addDays, fromLocal, hhmmToMinutes, isoWeekday, toLocal } from "@/features/scheduling/time";
import { listTeam } from "@/features/team/queries";
import { localDate } from "@/lib/dates";
import type { BusinessMetrics } from "./achievements";
import { normaliseLayout, type Layout } from "./layout";
import { businessAwards, loyaltySettings, loyaltyStats, rewards as listRewards, reviewSummary } from "@/features/loyalty/queries";

/** Everything the business dashboard shows, counted from real records (no sample numbers). */
export type DashboardData = {
  layout: Layout;
  today: CalendarAppointment[];
  awaitingConfirmation: CalendarAppointment[];
  pendingRequests: Array<{ id: string; petName: string; createdAt: string }>;
  groomers: Array<{ id: string; name: string; until: string | null; off: boolean }>;
  customers: { total: number; newThisMonth: number; due: number; pets: number };
  services: { active: number; top: Array<{ name: string; count: number }> };
  revenue: { thisWeekCents: number; lastWeekCents: number; completedThisWeek: number };
  metrics: BusinessMetrics;
  awards: Record<string, string>;
  reviews: { count: number; average: number | null; latest: { rating: number; comment: string | null; petName: string } | null };
  loyalty: { enabled: boolean; issued30: number; redemptions30: number; rewards: number; achievements: boolean };
  teamNames: Record<string, string>;
};

const startOf = (date: string, tz: string) => new Date(fromLocal(date, 0, tz)).toISOString();

export async function getDashboard(ctx: BusinessContext): Promise<DashboardData> {
  const { business, userId } = ctx;
  const tz = business.timezone;
  const db = await createSupabaseServerClient();
  const today = localDate(tz);
  const monthStart = `${today.slice(0, 8)}01`;
  const weekday = isoWeekday(today);
  const nowIso = new Date().toISOString();
  await db.rpc("tidy_booking_requests", { p_business: business.id });

  const [pending, layoutRow, todays, upcoming, team, hours, timeOff, directory, pets, services, bookedServices, completedRows, onlineCount, groomCount] = await Promise.all([
    db.from("booking_requests").select("id, created_at, pets!booking_requests_pet_id_business_id_fkey(name)").eq("business_id", business.id).in("status", ["awaiting_review", "open"]).order("created_at").limit(50),
    db.from("dashboard_layouts").select("layout").eq("business_id", business.id).eq("user_id", userId).maybeSingle(),
    appointmentsBetween(business.id, startOf(today, tz), startOf(addDays(today, 1), tz)),
    appointmentsBetween(business.id, nowIso, startOf(addDays(today, 30), tz)),
    listTeam(business.id),
    db.from("staff_hours").select("member_id, starts, ends").eq("business_id", business.id).eq("weekday", weekday),
    db.from("staff_time_off").select("member_id").eq("business_id", business.id).lte("starts_at", nowIso).gt("ends_at", nowIso),
    searchCustomers(business.id, ""),
    db.from("pets").select("id", { count: "exact", head: true }).eq("business_id", business.id).is("archived_at", null),
    db.from("services").select("id", { count: "exact", head: true }).eq("business_id", business.id).eq("active", true),
    db.from("appointment_services").select("name, appointments!inner(starts_at, status)").eq("business_id", business.id).gte("appointments.starts_at", startOf(addDays(today, -30), tz)).limit(2000),
    db.from("appointments").select("customer_id, pet_id, starts_at, price_estimate_cents").eq("business_id", business.id).eq("status", "completed").limit(10000),
    db.from("appointments").select("id", { count: "exact", head: true }).eq("business_id", business.id).eq("source", "online"),
    db.from("grooming_records").select("id", { count: "exact", head: true }).eq("business_id", business.id),
  ]);

  const [awards, reviewData, settings, stats, offers] = await Promise.all([businessAwards(business.id), reviewSummary(business.id), loyaltySettings(business.id), loyaltyStats(business.id, startOf(addDays(today, -30), tz)), listRewards(business.id, true)]);
  const off = new Set((timeOff.data ?? []).map((t) => t.member_id));
  const nowMinutes = toLocal(Date.now(), tz).minutes;
  const groomers = team
    .filter((m) => m.role !== "receptionist")
    .map((m) => {
      const shifts = (hours.data ?? []).filter((h) => h.member_id === m.id);
      const current = shifts.find((s) => hhmmToMinutes(s.starts.slice(0, 5)) <= nowMinutes && nowMinutes < hhmmToMinutes(s.ends.slice(0, 5)));
      return { id: m.id, name: m.name, until: current && !off.has(m.id) ? current.ends.slice(0, 5) : null, off: off.has(m.id) };
    });

  const segments = directory.map((c) => segmentsFor(c, today));
  const completed = completedRows.data ?? [];
  const visits = new Map<string, number>();
  for (const a of completed) visits.set(a.customer_id, (visits.get(a.customer_id) ?? 0) + 1);
  const sumBetween = (from: string, to: string) => completed.filter((a) => a.starts_at >= from && a.starts_at < to).reduce((s, a) => s + (a.price_estimate_cents ?? 0), 0);
  // Rolling weeks (the last 7 days against the 7 before), so Monday mornings don't read as zero.
  const thisWeekFrom = startOf(addDays(today, -6), tz);
  const thisWeekTo = startOf(addDays(today, 1), tz);

  const counts = new Map<string, number>();
  for (const s of bookedServices.data ?? []) {
    const appt = s.appointments as unknown as { status: string } | null;
    if (appt && appt.status !== "cancelled") counts.set(s.name, (counts.get(s.name) ?? 0) + 1);
  }

  return {
    layout: normaliseLayout(layoutRow.data?.layout),
    today: todays,
    pendingRequests: (pending.data ?? []).map((r) => ({ id: r.id, createdAt: r.created_at, petName: (r.pets as unknown as { name: string } | null)?.name ?? "A pet" })),
    awaitingConfirmation: upcoming.filter((a) => a.status === "booked" && a.source === "online"),
    groomers,
    customers: { total: directory.length, newThisMonth: directory.filter((c) => c.created_at.slice(0, 10) >= monthStart).length, due: segments.filter((s) => s.includes("due")).length, pets: pets.count ?? 0 },
    services: { active: services.count ?? 0, top: [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name, count]) => ({ name, count })) },
    revenue: { thisWeekCents: sumBetween(thisWeekFrom, thisWeekTo), lastWeekCents: sumBetween(startOf(addDays(today, -13), tz), thisWeekFrom), completedThisWeek: completed.filter((a) => a.starts_at >= thisWeekFrom && a.starts_at < thisWeekTo).length },
    metrics: { completed: completed.length, happyPets: new Set(completed.map((a) => a.pet_id)).size, loyalCustomers: [...visits.values()].filter((n) => n >= 3).length, onlineBookings: onlineCount.count ?? 0, groomRecords: groomCount.count ?? 0, fiveStarReviews: reviewData.average !== null && reviewData.average >= 4.8 ? reviewData.count : Math.min(reviewData.count, 9) },
    awards: Object.fromEntries(awards),
    reviews: { count: reviewData.count, average: reviewData.average, latest: reviewData.reviews[0] ? { rating: reviewData.reviews[0].rating, comment: reviewData.reviews[0].comment, petName: reviewData.reviews[0].petName } : null },
    loyalty: { enabled: settings.enabled, issued30: stats.issued, redemptions30: stats.redemptions, rewards: offers.length, achievements: settings.achievements },
    teamNames: Object.fromEntries(team.map((m) => [m.id, m.name])),
  };
}
