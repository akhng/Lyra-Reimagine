import type { Metadata } from "next";
import { CalendarPlus, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Badge, EmptyState, buttonVariants, cn } from "@lyra/ui";
import { requireBusiness } from "@lyra/platform/tenancy/context";
import { can } from "@lyra/platform/tenancy/roles";
import { PageHeader } from "@/components/PageHeader";
import { CalendarGrid, type GridAppointment, type GridColumn } from "@/components/scheduling/CalendarGrid";
import { STATUS_TONE } from "@/components/scheduling/status";
import { appointmentsBetween, schedulingSetup } from "@/features/scheduling/queries";
import { STATUS_LABEL } from "@/features/scheduling/schemas";
import { addDays, fromLocal, hhmmToMinutes, isoWeekday, localToday, minutesToHhmm, toLocal } from "@/features/scheduling/time";
import { listTeam } from "@/features/team/queries";
import { param } from "@/lib/params";
import { Mascot } from "@/components/mascots/Mascot";

export const metadata: Metadata = { title: "Calendar" };

const dayLabel = (date: string, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-AU", { ...opts, timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));

/** /b/[slug]/calendar — day view (groomer columns) or week view (one groomer), with drag-to-reschedule. */
export default async function CalendarPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const { business, role } = await requireBusiness(slug);
  const tz = business.timezone;
  const today = localToday(tz);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(param(sp.date)) ? param(sp.date) : today;
  const view = param(sp.view) === "week" ? "week" : "day";
  const [team, setup] = await Promise.all([listTeam(business.id), schedulingSetup(business.id)]);
  const locations = setup.locations.filter((l) => !l.isMobile).length ? setup.locations.filter((l) => !l.isMobile) : setup.locations;
  const location = locations.find((l) => l.id === param(sp.location)) ?? locations[0];
  const zone = location?.timezone ?? tz;
  const weekStart = addDays(date, 1 - isoWeekday(date));
  const days = view === "week" ? Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)) : [date];
  const from = new Date(fromLocal(days[0] ?? date, 0, zone)).toISOString();
  const to = new Date(fromLocal(addDays(days[days.length - 1] ?? date, 1), 0, zone)).toISOString();
  const appts = location ? (await appointmentsBetween(business.id, from, to)).filter((a) => a.locationId === location.id) : [];
  const groomerFor = (id: string) => team.find((m) => m.id === id)?.name ?? "Team member";
  const staffOn = (memberId: string, d: string) => setup.staffHours.filter((h) => h.memberId === memberId && h.locationId === location?.id && h.weekday === isoWeekday(d)).map((h): [number, number] => [hhmmToMinutes(h.starts), hhmmToMinutes(h.ends)]);
  const weekGroomer = team.find((m) => m.id === param(sp.groomer)) ?? team.find((m) => setup.staffHours.some((h) => h.memberId === m.id)) ?? team[0];

  let columns: GridColumn[];
  if (view === "day") {
    const ids = new Set([...setup.staffHours.filter((h) => h.locationId === location?.id && h.weekday === isoWeekday(date)).map((h) => h.memberId), ...appts.map((a) => a.groomerId)]);
    columns = team.filter((m) => ids.has(m.id)).map((m) => ({ key: m.id, label: m.name, date, groomerId: m.id, workingWindows: staffOn(m.id, date) }));
  } else {
    columns = weekGroomer ? days.map((d) => ({ key: d, label: dayLabel(d, { weekday: "short", day: "numeric", month: "short" }), date: d, groomerId: weekGroomer.id, workingWindows: staffOn(weekGroomer.id, d) })) : [];
  }
  const gridAppts: GridAppointment[] = appts
    .filter((a) => view === "day" || a.groomerId === weekGroomer?.id)
    .map((a) => {
      const s = toLocal(Date.parse(a.startsAt), zone);
      const e = toLocal(Date.parse(a.serviceEndsAt), zone);
      const b = toLocal(Date.parse(a.endsAt), zone);
      return { id: a.id, columnKey: view === "day" ? a.groomerId : s.date, groomerId: a.groomerId, date: s.date, startMin: s.minutes, serviceEndMin: e.date === s.date ? e.minutes : 24 * 60, blockEndMin: b.date === s.date ? b.minutes : 24 * 60, status: a.status, title: `${a.petName} · ${a.customerName}`, detail: a.services.join(", "), online: a.source === "online" };
    });
  const bounds = [
    ...setup.locationHours.filter((h) => h.locationId === location?.id).flatMap((h) => [hhmmToMinutes(h.opens), hhmmToMinutes(h.closes)]),
    ...columns.flatMap((c) => c.workingWindows.flat()),
    ...gridAppts.flatMap((a) => [a.startMin, a.serviceEndMin]),
  ];
  const startMin = bounds.length ? Math.floor(Math.min(...bounds) / 60) * 60 : 8 * 60;
  const endMin = bounds.length ? Math.ceil(Math.max(...bounds) / 60) * 60 : 18 * 60;
  const step = view === "week" ? 7 : 1;
  const href = (q: Record<string, string>) => `/b/${slug}/calendar?${new URLSearchParams({ date, view, ...(location ? { location: location.id } : {}), ...(view === "week" && weekGroomer ? { groomer: weekGroomer.id } : {}), ...q })}`;
  const canBook = can(role, "appointments.manage");
  const title = view === "day" ? dayLabel(date, { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : `Week of ${dayLabel(weekStart, { day: "numeric", month: "long", year: "numeric" })}`;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5">
      <PageHeader
        title="Calendar"
        description={title}
        actions={canBook ? <Link href={`/b/${slug}/appointments/new?date=${date}`} className={buttonVariants()}><CalendarPlus className="size-4" aria-hidden /> New appointment</Link> : null}
      />
      <div className="flex flex-wrap items-center gap-2">
        <nav aria-label="Dates" className="flex items-center gap-1">
          <Link href={href({ date: addDays(date, -step) })} className={buttonVariants({ variant: "secondary", size: "icon" })} aria-label={view === "week" ? "Previous week" : "Previous day"}><ChevronLeft className="size-4" aria-hidden /></Link>
          <Link href={href({ date: today })} className={buttonVariants({ variant: "secondary" })}>Today</Link>
          <Link href={href({ date: addDays(date, step) })} className={buttonVariants({ variant: "secondary", size: "icon" })} aria-label={view === "week" ? "Next week" : "Next day"}><ChevronRight className="size-4" aria-hidden /></Link>
        </nav>
        <nav aria-label="View" className="flex rounded-full border border-border bg-surface p-1">
          {(["day", "week"] as const).map((v) => (
            <Link key={v} href={href({ view: v })} aria-current={view === v ? "page" : undefined} className={cn("inline-flex min-h-9 items-center rounded-full px-4 text-sm font-medium", view === v ? "bg-primary text-primary-contrast" : "text-muted hover:text-text")}>
              {v === "day" ? "Day" : "Week"}
            </Link>
          ))}
        </nav>
        <form action={`/b/${slug}/calendar`} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="date" value={date} />
          <input type="hidden" name="view" value={view} />
          {locations.length > 1 ? (
            <label className="flex items-center gap-2 text-sm">
              Location
              <select name="location" defaultValue={location?.id} className="h-11 rounded-[var(--radius-control)] border border-border bg-surface px-3">
                {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </label>
          ) : null}
          {view === "week" ? (
            <label className="flex items-center gap-2 text-sm">
              Groomer
              <select name="groomer" defaultValue={weekGroomer?.id} className="h-11 rounded-[var(--radius-control)] border border-border bg-surface px-3">
                {team.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </label>
          ) : null}
          {locations.length > 1 || view === "week" ? <button type="submit" className={buttonVariants({ variant: "secondary" })}>Show</button> : null}
        </form>
      </div>

      {!location ? (
        <EmptyState art={<Mascot name="biscuit" mood="sleepy" className="w-28" />} title="Add a location first" description="The calendar is per location." action={<Link href={`/b/${slug}/settings#locations`} className={buttonVariants()}>Settings</Link>} />
      ) : columns.length === 0 ? (
        <EmptyState art={<Mascot name="biscuit" mood="sleepy" className="w-28" />} title="Nobody is rostered" description={setup.staffHours.length ? "No one works at this location on this day." : "Set your team's working hours so the calendar knows who's on."} action={can(role, "hours.manage") ? <Link href={`/b/${slug}/settings/hours`} className={buttonVariants()}>Set hours</Link> : undefined} />
      ) : (
        <>
          <div className="hidden md:block">
            <CalendarGrid slug={slug} timeZone={zone} columns={columns} appointments={gridAppts} startMin={startMin} endMin={endMin} canMove={canBook} />
          </div>
          <section aria-label="Appointments" className="md:hidden">
            {appts.length === 0 ? (
              <p className="rounded-[var(--radius-card)] border border-dashed border-border bg-surface p-6 text-center text-sm text-muted">No appointments {view === "day" ? "on this day" : "this week"}.</p>
            ) : (
              <ol className="flex flex-col gap-2">
                {appts.filter((a) => view === "day" || a.groomerId === weekGroomer?.id).map((a) => {
                  const s = toLocal(Date.parse(a.startsAt), zone);
                  const e = toLocal(Date.parse(a.serviceEndsAt), zone);
                  return (
                    <li key={a.id}>
                      <Link href={`/b/${slug}/appointments/${a.id}`} className="flex items-center gap-3 rounded-[var(--radius-card)] border border-border bg-surface p-3">
                        <span className="w-20 shrink-0 text-sm font-semibold tabular">{view === "week" ? <span className="block text-xs font-normal text-muted">{dayLabel(s.date, { weekday: "short", day: "numeric" })}</span> : null}{minutesToHhmm(s.minutes)}–{minutesToHhmm(e.minutes)}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{a.petName} · {a.customerName}</span>
                          <span className="block truncate text-xs text-muted">{[groomerFor(a.groomerId), a.services.join(", ")].filter(Boolean).join(" · ")}</span>
                        </span>
                        <Badge tone={STATUS_TONE[a.status]}>{STATUS_LABEL[a.status]}</Badge>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </>
      )}
    </div>
  );
}
