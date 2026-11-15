import type { Metadata } from "next";
import { ListPlus } from "lucide-react";
import Link from "next/link";
import { Badge, Card, CardTitle, EmptyState, buttonVariants } from "@lyra/ui";
import { createSupabaseServerClient } from "@lyra/platform/supabase/server";
import { requireBusiness } from "@lyra/platform/tenancy/context";
import { can } from "@lyra/platform/tenancy/roles";
import { PageHeader } from "@/components/PageHeader";
import { WaitlistForm, WaitlistStatus } from "@/components/scheduling/WaitlistControls";
import { availability, blockFor } from "@/features/scheduling/availability";
import { appointmentsBetween, schedulingSetup, waitlist } from "@/features/scheduling/queries";
import { addDays, fromLocal, localToday, minutesToHhmm } from "@/features/scheduling/time";
import { listServices } from "@/features/services/queries";
import { listTeam } from "@/features/team/queries";
import { Mascot } from "@/components/mascots/Mascot";

export const metadata: Metadata = { title: "Waitlist" };

const dayLabel = (d: string) => new Intl.DateTimeFormat("en-AU", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));

/** /b/[slug]/waitlist — customers wanting an earlier slot, with openings found from current hours and bookings. */
export default async function WaitlistPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { business, role } = await requireBusiness(slug);
  const tz = business.timezone;
  const today = localToday(tz);
  const horizon = addDays(today, 30);
  const db = await createSupabaseServerClient();
  const [entries, setup, team, services, { data: rows }, appts] = await Promise.all([
    waitlist(business.id),
    schedulingSetup(business.id, { fromIso: new Date().toISOString(), toIso: new Date(fromLocal(horizon, 0, tz)).toISOString() }),
    listTeam(business.id),
    listServices(business.id, { activeOnly: true }),
    db.from("customers").select("id, first_name, last_name, pets(id, name, size, breed, archived_at)").eq("business_id", business.id).is("archived_at", null).order("first_name").limit(1000),
    appointmentsBetween(business.id, new Date().toISOString(), new Date(fromLocal(horizon, 0, tz)).toISOString()),
  ]);
  const location = setup.locations.find((l) => !l.isMobile) ?? setup.locations[0];
  const canManage = can(role, "appointments.manage");
  const openingsFor = (e: (typeof entries)[number]) => {
    if (!location) return [];
    const from = e.earliest_on > today ? e.earliest_on : today;
    const to = e.latest_on < horizon ? e.latest_on : horizon;
    if (to < from) return [];
    const chosen = services.filter((s) => e.service_ids.includes(s.id));
    const block = chosen.length ? blockFor(chosen.map((s) => ({ durationMinutes: s.duration_minutes, bufferMinutes: s.buffer_minutes }))) : { durationMinutes: 60, bufferMinutes: 0 };
    const days = availability({
      timeZone: location.timezone ?? tz, locationId: location.id,
      locationHours: setup.locationHours.filter((h) => h.locationId === location.id), staffHours: setup.staffHours,
      busy: [...appts.map((a) => ({ memberId: a.groomerId, startsAt: a.startsAt, endsAt: a.endsAt })), ...setup.timeOff.map((t) => ({ memberId: t.memberId, startsAt: t.startsAt, endsAt: t.endsAt }))],
      closures: setup.closures, policy: { minNoticeMinutes: 60, maxDaysAhead: 31, slotStepMinutes: 30 }, ...block,
      groomerId: e.preferred_groomer_id, from, to, now: new Date(),
    });
    return days.flatMap((d) => d.slots.map((s) => ({ date: d.date, time: minutesToHhmm(s.localMinutes), groomerId: s.groomerIds[0] ?? "" }))).slice(0, 4);
  };
  const customers = (rows ?? []).map((c) => ({ id: c.id, name: `${c.first_name} ${c.last_name ?? ""}`.trim(), pets: c.pets.filter((p) => !p.archived_at).map((p) => ({ id: p.id, name: p.name, size: p.size, breed: p.breed })) }));
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <PageHeader title="Waitlist" description="Customers who want an earlier or specific slot. Openings are worked out from today's hours and bookings." />
      {entries.length === 0 ? (
        <EmptyState art={<Mascot name="luna" mood="sleepy" className="w-28" />} icon={<ListPlus />} title="Nobody is waiting" description="Add a customer when they'd like an earlier slot than you can offer. Lyra Pet shows openings as soon as they appear." />
      ) : (
        <ul className="flex flex-col gap-3">
          {entries.map((e) => {
            const openings = openingsFor(e);
            const wanted = services.filter((s) => e.service_ids.includes(s.id)).map((s) => s.name);
            return (
              <li key={e.id}>
                <Card className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{e.pets.name} · {e.customers.first_name} {e.customers.last_name ?? ""}</p>
                      <p className="text-sm text-muted">{dayLabel(e.earliest_on)} – {dayLabel(e.latest_on)}{wanted.length ? ` · ${wanted.join(", ")}` : ""}{e.preferred_groomer_id ? ` · prefers ${team.find((m) => m.id === e.preferred_groomer_id)?.name ?? "a groomer"}` : ""}</p>
                      {e.notes ? <p className="mt-1 text-sm">{e.notes}</p> : null}
                    </div>
                    <Badge tone={e.status === "offered" ? "primary" : "neutral"}>{e.status === "offered" ? "Offered" : "Waiting"}</Badge>
                  </div>
                  {openings.length ? (
                    <div>
                      <p className="mb-2 text-sm font-medium">Openings</p>
                      <div className="flex flex-wrap gap-2">
                        {openings.map((o) => canManage ? (
                          <Link key={`${o.date}-${o.time}`} href={`/b/${slug}/appointments/new?customer=${e.customer_id}&pet=${e.pet_id}&date=${o.date}&time=${o.time}&groomer=${o.groomerId}`} className={buttonVariants({ variant: "secondary", size: "sm" })}>{dayLabel(o.date)} {o.time}</Link>
                        ) : <span key={`${o.date}-${o.time}`} className="text-sm">{dayLabel(o.date)} {o.time}</span>)}
                      </div>
                    </div>
                  ) : <p className="text-sm text-muted">No openings in their window yet.</p>}
                  {canManage ? <WaitlistStatus slug={slug} id={e.id} status={e.status} /> : null}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
      {canManage ? (
        <Card aria-labelledby="add-title">
          <CardTitle id="add-title">Add to waitlist</CardTitle>
          <div className="mt-3"><WaitlistForm slug={slug} customers={customers} services={services.map((s) => ({ id: s.id, name: s.name }))} groomers={team.map((m) => ({ id: m.id, name: m.name }))} today={today} /></div>
        </Card>
      ) : null}
    </div>
  );
}
