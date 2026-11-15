import type { Metadata } from "next";
import { CalendarPlus } from "lucide-react";
import { notFound } from "next/navigation";
import { Badge, buttonVariants } from "@lyra/ui";
import { ManageBooking } from "@/components/booking/ManageBooking";
import { getBookingByToken, getBookingContext } from "@/features/booking/queries";
import { minutesToHhmm, toLocal } from "@/features/scheduling/time";
import { formatAud } from "@/features/services/pricing";
import { param } from "@/lib/params";

export const metadata: Metadata = { title: "Your booking", robots: { index: false, follow: false } };

/** /book/manage/[token] — the private manage link: confirmation, add to calendar, cancel or change. */
export default async function ManagePage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { token } = await params;
  const sp = await searchParams;
  const b = await getBookingByToken(token);
  if (!b) notFound();
  const ctx = b.changeable ? await getBookingContext(b.business.slug) : null;
  const tz = b.business.timezone;
  const s = toLocal(Date.parse(b.startsAt), tz);
  const e = toLocal(Date.parse(b.endsAt), tz);
  const day = new Intl.DateTimeFormat("en-AU", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: tz }).format(new Date(b.startsAt));
  const cancelled = b.status === "cancelled";
  const banner = param(sp.booked) ? "You're booked! Save this page: it's your private link to change or cancel." : param(sp.moved) ? "Your appointment has been moved." : param(sp.cancelled) ? "Your appointment has been cancelled." : null;
  return (
    <div className="flex flex-col gap-6">
      {banner ? <p role="status" className="rounded-[var(--radius-control)] bg-success-tint px-4 py-3 text-sm font-medium text-success">{banner}</p> : null}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-primary-text">{b.business.name}</p>
          <h1 className="font-display text-3xl font-bold text-navy">{cancelled ? "Cancelled booking" : "Your booking"}</h1>
        </div>
        <Badge tone={cancelled ? "danger" : "success"}>{cancelled ? "Cancelled" : "Booked"}</Badge>
      </header>
      <section aria-labelledby="when" className="rounded-[var(--radius-card)] border border-border bg-surface p-5 shadow-[var(--shadow-card)]">
        <h2 id="when" className="font-display text-xl font-semibold">{day}, {minutesToHhmm(s.minutes)}–{minutesToHhmm(e.minutes)}</h2>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div><dt className="text-muted">Pet</dt><dd>{b.pet}</dd></div>
          <div><dt className="text-muted">Groomer</dt><dd>{b.groomer}</dd></div>
          <div><dt className="text-muted">Where</dt><dd>{[b.location.name, b.location.addressLine, b.location.suburb].filter(Boolean).join(", ")}</dd></div>
          <div><dt className="text-muted">Services</dt><dd>{b.services.map((x) => x.name).join(", ")}</dd></div>
          <div><dt className="text-muted">Estimate</dt><dd className="tabular">{b.priceCents !== null ? `${b.priceFrom ? "From " : ""}${formatAud(b.priceCents)}` : "—"}</dd></div>
          <div><dt className="text-muted">Contact the salon</dt><dd>{[b.business.phone, b.business.email].filter(Boolean).join(" · ") || "—"}</dd></div>
        </dl>
        {!cancelled ? <a href={`/book/manage/${token}/calendar`} className={`${buttonVariants({ variant: "secondary" })} mt-4`}><CalendarPlus className="size-4" aria-hidden /> Add to calendar</a> : null}
      </section>
      {b.policyText ? <p className="rounded-[var(--radius-control)] bg-surface-2 px-4 py-3 text-sm whitespace-pre-line">{b.policyText}</p> : null}
      {cancelled ? null : b.changeable ? (
        <section aria-labelledby="change" className="flex flex-col gap-3">
          <h2 id="change" className="font-display text-lg font-semibold">Need to change it?</h2>
          <p className="text-sm text-muted">You can change or cancel online up to {b.cancellationHours} hours before the appointment.</p>
          {/* eslint-disable-next-line react-hooks/purity -- the request time anchors the available slots for this render */}
          <ManageBooking token={token} ctx={ctx?.online ? ctx : null} booking={{ locationId: b.locationId, groomerId: b.groomerId, blockMinutes: b.blockMinutes, groomer: b.groomer }} nowMs={Date.now()} />
        </section>
      ) : (
        <p className="text-sm text-muted">It&apos;s too close to the appointment to change it online. Please contact the salon.</p>
      )}
    </div>
  );
}
