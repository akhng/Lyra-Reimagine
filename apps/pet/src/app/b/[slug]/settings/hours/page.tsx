import type { Metadata } from "next";
import { Card, CardDescription, CardTitle } from "@lyra/ui";
import { serverEnv } from "@lyra/platform/env";
import { requireBusiness } from "@lyra/platform/tenancy/context";
import { can } from "@lyra/platform/tenancy/roles";
import { PageHeader } from "@/components/PageHeader";
import { ClosureForm, LocationHoursForm, PolicyForm, RemoveButton, StaffHoursForm, TimeOffForm } from "@/components/scheduling/HoursForms";
import { schedulingSetup } from "@/features/scheduling/queries";
import { localToday } from "@/features/scheduling/time";
import { listTeam } from "@/features/team/queries";

export const metadata: Metadata = { title: "Hours & online booking" };

const fmt = (iso: string, tz: string) => new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: tz }).format(new Date(iso));

/** /b/[slug]/settings/hours — opening hours, team hours, time off, closures and online booking (owners and managers edit). */
export default async function HoursPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { business, role } = await requireBusiness(slug);
  const [setup, team] = await Promise.all([schedulingSetup(business.id), listTeam(business.id)]);
  const tz = business.timezone;
  const today = localToday(tz);
  const locations = setup.locations.filter((l) => !l.isMobile);
  const editable = can(role, "hours.manage");
  const bookingUrl = `${serverEnv().APP_URL}/book/${business.slug}`;
  const member = (id: string) => team.find((m) => m.id === id)?.name ?? "Team member";
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader title="Hours & online booking" description="When you're open, who works when, and how customers book online." back={{ href: `/b/${slug}/settings`, label: "Settings" }} />
      {!editable ? <p className="rounded-[var(--radius-control)] bg-surface-2 px-4 py-3 text-sm text-muted">Only owners and managers can change these settings.</p> : null}
      <fieldset disabled={!editable} className="contents">
        <Card aria-labelledby="online-title">
          <CardTitle id="online-title">Online booking</CardTitle>
          <CardDescription>Customers pick services, a time and a groomer. Only services marked &quot;bookable online&quot; are shown, and online bookings must fit your hours.</CardDescription>
          <div className="mt-4"><PolicyForm slug={slug} policy={setup.policy} bookingUrl={bookingUrl} /></div>
        </Card>
        {locations.map((l) => (
          <Card key={l.id} aria-labelledby={`loc-${l.id}`}>
            <CardTitle id={`loc-${l.id}`}>Opening hours · {l.name}</CardTitle>
            <div className="mt-3"><LocationHoursForm slug={slug} locationId={l.id} hours={setup.locationHours.filter((h) => h.locationId === l.id)} /></div>
          </Card>
        ))}
        <Card aria-labelledby="team-title">
          <CardTitle id="team-title">Team hours</CardTitle>
          <CardDescription>Online booking only offers times inside a groomer&apos;s hours. Staff can still book outside them.</CardDescription>
          <div className="mt-4 flex flex-col gap-6">
            {team.map((m) => (
              <section key={m.id} aria-labelledby={`staff-${m.id}`} className="flex flex-col gap-2">
                <h3 id={`staff-${m.id}`} className="font-medium">{m.name} <span className="text-sm font-normal text-muted capitalize">· {m.role}</span></h3>
                <StaffHoursForm slug={slug} memberId={m.id} name={m.name} locations={locations.map((x) => ({ id: x.id, name: x.name }))} hours={setup.staffHours.filter((h) => h.memberId === m.id)} />
              </section>
            ))}
          </div>
        </Card>
        <Card aria-labelledby="off-title">
          <CardTitle id="off-title">Time off</CardTitle>
          <ul className="mt-3 flex flex-col gap-1 text-sm">
            {setup.timeOff.length ? setup.timeOff.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2 rounded-[var(--radius-control)] bg-surface-2 px-3 py-1">
                <span>{member(t.memberId)}: {fmt(t.startsAt, tz)} – {fmt(t.endsAt, tz)}{t.reason ? ` · ${t.reason}` : ""}</span>
                {editable ? <RemoveButton slug={slug} kind="timeOff" id={t.id} label={`Remove time off for ${member(t.memberId)}`} /> : null}
              </li>
            )) : <li className="text-muted">No upcoming time off.</li>}
          </ul>
          <div className="mt-4"><TimeOffForm slug={slug} members={team.map((m) => ({ id: m.id, name: m.name }))} today={today} /></div>
        </Card>
        <Card aria-labelledby="closed-title">
          <CardTitle id="closed-title">Closures and public holidays</CardTitle>
          <ul className="mt-3 flex flex-col gap-1 text-sm">
            {setup.closures.length ? setup.closures.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2 rounded-[var(--radius-control)] bg-surface-2 px-3 py-1">
                <span>{c.startsOn === c.endsOn ? c.startsOn : `${c.startsOn} – ${c.endsOn}`} · {c.locationId ? (locations.find((l) => l.id === c.locationId)?.name ?? "Location") : "Whole business"}{c.reason ? ` · ${c.reason}` : ""}</span>
                {editable ? <RemoveButton slug={slug} kind="closure" id={c.id} label={`Remove closure ${c.startsOn}`} /> : null}
              </li>
            )) : <li className="text-muted">No upcoming closures.</li>}
          </ul>
          <div className="mt-4"><ClosureForm slug={slug} locations={locations.map((l) => ({ id: l.id, name: l.name }))} today={today} /></div>
        </Card>
      </fieldset>
    </div>
  );
}
