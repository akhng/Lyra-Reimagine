import type { Metadata } from "next";
import { Globe, Repeat, Scissors } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, CardTitle, buttonVariants } from "@lyra/ui";
import { requireBusiness } from "@lyra/platform/tenancy/context";
import { can } from "@lyra/platform/tenancy/roles";
import { PageHeader } from "@/components/PageHeader";
import { NotesForm, RescheduleForm, StatusButtons } from "@/components/scheduling/AppointmentControls";
import { STATUS_TONE } from "@/components/scheduling/status";
import { getAppointment, schedulingSetup } from "@/features/scheduling/queries";
import { GROOMER_STATUSES, STATUSES, STATUS_LABEL } from "@/features/scheduling/schemas";
import { minutesToHhmm, toLocal } from "@/features/scheduling/time";
import { formatAud } from "@/features/services/pricing";
import { listTeam } from "@/features/team/queries";
import { param, uuidOr404 } from "@/lib/params";

export const metadata: Metadata = { title: "Appointment" };

export default async function AppointmentPage({ params, searchParams }: { params: Promise<{ slug: string; id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { slug, id: raw } = await params;
  const sp = await searchParams;
  const id = uuidOr404(raw);
  const { business, role, userId } = await requireBusiness(slug);
  const [a, team, setup] = await Promise.all([getAppointment(business.id, id), listTeam(business.id), schedulingSetup(business.id)]);
  if (!a) notFound();
  const zone = setup.locations.find((l) => l.id === a.locationId)?.timezone ?? business.timezone;
  const s = toLocal(Date.parse(a.startsAt), zone);
  const e = toLocal(Date.parse(a.serviceEndsAt), zone);
  const day = new Intl.DateTimeFormat("en-AU", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: zone }).format(new Date(a.startsAt));
  const groomer = team.find((m) => m.id === a.groomerId);
  const frontDesk = can(role, "appointments.manage");
  const isOwnGroomer = groomer?.userId === userId;
  const allowed = frontDesk ? [...STATUSES] : isOwnGroomer ? [...GROOMER_STATUSES] : [];
  const live = !["cancelled", "completed", "no_show"].includes(a.status);
  const skipped = param(sp.skipped).split(",").filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      <PageHeader
        back={{ href: `/b/${slug}/calendar?date=${s.date}`, label: "Calendar" }}
        title={`${a.petName} · ${a.customerName}`}
        description={`${day}, ${minutesToHhmm(s.minutes)}–${minutesToHhmm(e.minutes)} with ${groomer?.name ?? "a team member"}`}
        actions={<Badge tone={STATUS_TONE[a.status]}>{STATUS_LABEL[a.status]}</Badge>}
      />
      {skipped.length ? <p role="status" className="rounded-[var(--radius-control)] bg-warning-tint px-4 py-3 text-sm text-warning">Booked. These repeat dates clashed with other appointments and were skipped: {skipped.join(", ")}.</p> : null}
      {a.status === "cancelled" && a.cancellationReason ? <p className="rounded-[var(--radius-control)] bg-danger-tint px-4 py-3 text-sm text-danger">Cancelled: {a.cancellationReason}</p> : null}
      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-5">
          {allowed.length && live ? (
            <Card aria-labelledby="next-title">
              <CardTitle id="next-title">Next step</CardTitle>
              <div className="mt-3"><StatusButtons slug={slug} id={a.id} status={a.status} allowed={allowed} /></div>
            </Card>
          ) : null}
          {a.status === "completed" || a.status === "in_progress" ? (
            <Card aria-labelledby="groom-title">
              <CardTitle id="groom-title">Grooming record</CardTitle>
              {a.groomingRecordId ? (
                <p className="mt-2 text-sm">Recorded. <Link href={`/b/${slug}/pets/${a.petId}`} className="text-primary-text underline">See {a.petName}&apos;s history</Link></p>
              ) : (
                <Link href={`/b/${slug}/pets/${a.petId}/groom?appointment=${a.id}`} className={`${buttonVariants()} mt-3`}><Scissors className="size-4" aria-hidden /> Record groom</Link>
              )}
            </Card>
          ) : null}
          {frontDesk && live ? (
            <Card aria-labelledby="move-title">
              <CardTitle id="move-title">Reschedule</CardTitle>
              <div className="mt-3"><RescheduleForm slug={slug} id={a.id} date={s.date} time={minutesToHhmm(s.minutes)} groomerId={a.groomerId} groomers={team.map((m) => ({ id: m.id, name: m.name }))} /></div>
            </Card>
          ) : null}
          {frontDesk ? (
            <Card aria-labelledby="notes-title">
              <CardTitle id="notes-title" className="sr-only">Notes</CardTitle>
              <NotesForm slug={slug} id={a.id} notes={a.notes} />
            </Card>
          ) : a.notes ? <Card><CardTitle>Notes</CardTitle><p className="mt-2 whitespace-pre-line text-sm">{a.notes}</p></Card> : null}
        </div>
        <Card aria-labelledby="details-title">
          <CardTitle id="details-title">Details</CardTitle>
          <dl className="mt-3 flex flex-col gap-3 text-sm">
            <div><dt className="text-muted">Pet</dt><dd><Link href={`/b/${slug}/pets/${a.petId}`} className="text-primary-text underline-offset-4 hover:underline">{a.petName}</Link></dd></div>
            <div><dt className="text-muted">Customer</dt><dd><Link href={`/b/${slug}/customers/${a.customerId}`} className="text-primary-text underline-offset-4 hover:underline">{a.customerName}</Link></dd></div>
            <div><dt className="text-muted">Services</dt><dd>{a.services.join(", ") || "—"}</dd></div>
            <div><dt className="text-muted">Estimate</dt><dd className="tabular">{a.priceCents !== null ? `${a.priceFrom ? "From " : ""}${formatAud(a.priceCents)}` : "—"}</dd></div>
            {a.source === "online" ? <div className="flex items-center gap-1.5 text-muted"><Globe className="size-4" aria-hidden /> Booked online</div> : null}
            {a.seriesId ? <div className="flex items-center gap-1.5 text-muted"><Repeat className="size-4" aria-hidden /> Part of a repeating booking</div> : null}
            {a.customerNotes ? <div><dt className="text-muted">Customer&apos;s note</dt><dd className="whitespace-pre-line">{a.customerNotes}</dd></div> : null}
          </dl>
        </Card>
      </div>
    </div>
  );
}
