import type { Metadata } from "next";
import Link from "next/link";
import { Badge, buttonVariants, EmptyState } from "@lyra/ui";
import { Mascot } from "@/components/mascots/Mascot";
import { PageHeader } from "@/components/PageHeader";
import { requestWhen } from "@/components/portal/when";
import { myBookings } from "@/features/portal/queries";
import { ACTIVE_REQUEST, STATUS_TEXT } from "@/features/portal/schemas";
import { nowMs } from "@/features/scheduling/time";

export const metadata: Metadata = { title: "Bookings" };
const fmt = (iso: string, tz: string) => new Intl.DateTimeFormat("en-AU", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: tz }).format(new Date(iso));

/** Requests waiting for a reply, upcoming appointments and grooming history, across every salon. */
export default async function Bookings() {
  const { requests, appointments } = await myBookings();
  const now = nowMs();
  const waiting = requests.filter((r) => ACTIVE_REQUEST.includes(r.status));
  const upcoming = appointments.filter((a) => Date.parse(a.startsAt) > now && !["cancelled", "no_show", "completed"].includes(a.status)).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const history = appointments.filter((a) => a.status === "completed");
  const closed = requests.filter((r) => ["rejected", "cancelled", "expired"].includes(r.status)).slice(0, 10);
  const requestFor = (appointmentStart: string, petName: string) => requests.find((r) => r.appointmentStart === appointmentStart && r.petName === petName);
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Bookings" description="Your requests, appointments and grooming history." actions={<Link href="/me/book" className={buttonVariants()}>Book a groom</Link>} />
      <section aria-labelledby="waiting" className="flex flex-col gap-3">
        <h2 id="waiting" className="font-display text-2xl font-semibold text-ink">Waiting for a reply</h2>
        {waiting.length ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            {waiting.map((r) => (
              <li key={r.id}>
                <Link href={`/me/requests/${r.id}`} className="lift flex h-full flex-col gap-1 rounded-[var(--radius-card)] bg-butter-tint p-4 shadow-[var(--shadow-card)]">
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-display text-lg font-semibold text-ink">{r.petName} · {r.businessName}</span>
                    <Badge tone={STATUS_TEXT[r.status]?.tone ?? "neutral"}>{STATUS_TEXT[r.status]?.label ?? r.status}</Badge>
                  </span>
                  <span className="text-sm text-ink/80">{r.services.join(", ")}</span>
                  <span className="text-sm text-ink/80">{requestWhen(r)}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">No requests waiting.</p>
        )}
      </section>
      <section aria-labelledby="upcoming" className="flex flex-col gap-3">
        <h2 id="upcoming" className="font-display text-2xl font-semibold text-ink">Upcoming</h2>
        {upcoming.length ? (
          <ul className="flex flex-col gap-2">
            {upcoming.map((a) => {
              const r = requestFor(a.startsAt, a.petName);
              const body = (
                <>
                  <span className="w-36 shrink-0 font-bold text-ink tabular">{fmt(a.startsAt, a.timezone)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-ink">{a.petName} · {a.businessName}</span>
                    <span className="block text-sm text-muted">{[a.services.join(", "), a.groomerName ? `with ${a.groomerName}` : null].filter(Boolean).join(" · ")}</span>
                  </span>
                  <Badge tone="success">Confirmed</Badge>
                </>
              );
              return (
                <li key={a.id}>
                  {r ? (
                    <Link href={`/me/requests/${r.id}`} className="lift flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] bg-surface p-4 shadow-[var(--shadow-card)]">{body}</Link>
                  ) : (
                    <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] bg-surface p-4 shadow-[var(--shadow-card)]">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState art={<Mascot name="biscuit" mood="happy" className="w-24" />} title="Nothing booked yet" description="Confirmed appointments from any salon appear here." action={<Link href="/me/book" className={buttonVariants()}>Book a groom</Link>} />
        )}
      </section>
      <section id="history" aria-labelledby="history-title" className="flex flex-col gap-3">
        <h2 id="history-title" className="font-display text-2xl font-semibold text-ink">Grooming history</h2>
        {history.length ? (
          <ul className="grid gap-2 sm:grid-cols-2">
            {history.map((a) => {
              const req = requests.find((r) => r.appointmentId === a.id);
              const body = (
                <>
                  <Mascot name="mochi" mood="proud" pose="peek" className="w-12 shrink-0" />
                  <span>
                    <span className="block font-semibold text-ink">{a.petName} · {a.services.join(", ")}</span>
                    <span className="block text-sm text-ink/80">{new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "long", year: "numeric", timeZone: a.timezone }).format(new Date(a.startsAt))} · {a.businessName}</span>
                  </span>
                </>
              );
              return (
                <li key={a.id}>
                  {req ? (
                    <Link href={`/me/requests/${req.id}`} className="lift flex items-center gap-3 rounded-[var(--radius-card)] bg-mint-tint p-4">{body}</Link>
                  ) : (
                    <div className="flex items-center gap-3 rounded-[var(--radius-card)] bg-mint-tint p-4">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted">Completed grooms will collect here.</p>
        )}
      </section>
      {closed.length ? (
        <section aria-labelledby="closed" className="flex flex-col gap-2">
          <h2 id="closed" className="font-display text-lg font-semibold text-ink">Closed requests</h2>
          <ul className="flex flex-col gap-1 text-sm">
            {closed.map((r) => (
              <li key={r.id}>
                <Link href={`/me/requests/${r.id}`} className="inline-flex min-h-11 items-center gap-2 hover:underline">
                  <Badge tone={STATUS_TEXT[r.status]?.tone ?? "neutral"}>{STATUS_TEXT[r.status]?.label}</Badge> {r.petName} · {r.businessName}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
