import type { Metadata } from "next";
import Link from "next/link";
import { Badge, buttonVariants, EmptyState } from "@lyra/ui";
import { requireBusiness } from "@lyra/platform/tenancy/context";
import { can } from "@lyra/platform/tenancy/roles";
import { Mascot } from "@/components/mascots/Mascot";
import { PageHeader } from "@/components/PageHeader";
import { PetAvatar } from "@/components/PetAvatar";
import { CloseRequest } from "@/components/requests/CloseRequest";
import { ReviewControls } from "@/components/requests/ReviewControls";
import { allocationSettings } from "@/features/shifts/queries";
import { PART_LABEL, STATUS_TEXT } from "@/features/portal/schemas";
import { marketplaceProfile, requestsForBusiness } from "@/features/requests/queries";
import { minutesToHhmm, toLocal } from "@/features/scheduling/time";
import { formatAud } from "@/features/services/pricing";
import { listTeam } from "@/features/team/queries";

export const metadata: Metadata = { title: "Requests" };

/** Booking requests from pet owners, as visual cards; the front desk confirms a groomer and time or declines. */
export default async function Requests({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { business, role } = await requireBusiness(slug);
  const tz = business.timezone;
  const [all, team, listing, allocation] = await Promise.all([requestsForBusiness(business.id), listTeam(business.id), marketplaceProfile(business.id), allocationSettings(business.id)]);
  const nameOf = (id: string | null) => team.find((m) => m.id === id)?.name ?? null;
  const waiting = all.filter((r) => ["awaiting_review", "open", "submitted"].includes(r.status));
  const recent = all.filter((r) => !waiting.includes(r)).slice(0, 20);
  const canReview = can(role, "appointments.manage");
  const groomers = team.filter((m) => m.role !== "receptionist").map((m) => ({ id: m.id, name: m.name }));
  const fmt = (iso: string) => new Intl.DateTimeFormat("en-AU", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: tz }).format(new Date(iso));
  const dayFmt = (d: string) => new Intl.DateTimeFormat("en-AU", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader title="Booking requests" description={`Requests from pet owners on Lyra Pet. Nothing is booked until a groomer and time are confirmed. Allocation: ${({ manual: "front desk reviews", open: "open to groomers", automatic: "automatic", assigned_only: "assigned groomer only" } as Record<string, string>)[allocation.mode] ?? allocation.mode}.`} actions={can(role, "business.edit") ? <Link href={`/b/${slug}/settings/listing`} className={buttonVariants({ variant: "secondary" })}>Listing settings</Link> : null} />
      {!listing?.listed ? (
        <p className="rounded-[var(--radius-card)] bg-butter-tint p-4 text-sm font-semibold text-ink">Your salon isn&apos;t listed on Lyra Pet yet, so new requests can&apos;t arrive. {can(role, "business.edit") ? <Link href={`/b/${slug}/settings/listing`} className="underline">Turn on your listing</Link> : "Ask an owner or manager to turn on the listing."}</p>
      ) : null}
      <section aria-labelledby="waiting" className="flex flex-col gap-3">
        <h2 id="waiting" className="font-display text-2xl font-semibold text-ink">Waiting for you {waiting.length ? <span className="text-muted">({waiting.length})</span> : null}</h2>
        {waiting.length ? (
          <ul className="grid gap-4 lg:grid-cols-2">
            {waiting.map((r) => {
              const pref = r.preferredStart ? toLocal(Date.parse(r.preferredStart), tz) : null;
              return (
                <li key={r.id}>
                  <article className="lift flex h-full flex-col gap-3 rounded-[var(--radius-card)] bg-coral-tint p-5 shadow-[var(--shadow-card)]">
                    <div className="flex items-center gap-4">
                      <PetAvatar url={r.pet.photoUrl} species={r.pet.species} name={r.pet.name} size="lg" alt={r.pet.photoUrl ? `Photo of ${r.pet.name}` : ""} />
                      <div className="min-w-0">
                        <h3 className="font-display text-2xl leading-tight font-bold text-ink">{r.pet.name}</h3>
                        <p className="text-sm font-semibold text-ink/80">{[r.pet.breed ?? (r.pet.species === "cat" ? "Cat" : "Dog"), r.pet.size].filter(Boolean).join(" · ")}</p>
                        <p className="text-xs text-muted">Owner: {r.customerName}</p>
                      </div>
                    </div>
                    <dl className="grid grid-cols-2 gap-2 text-sm">
                      <div className="col-span-2 rounded-2xl bg-surface/80 px-3 py-2"><dt className="text-xs text-muted">Services</dt><dd className="font-semibold text-ink">{r.services.join(", ")}</dd></div>
                      <div className="rounded-2xl bg-surface/80 px-3 py-2"><dt className="text-xs text-muted">Asked for</dt><dd className="font-semibold text-ink">{r.preferredStart ? fmt(r.preferredStart) : r.windows.map((w) => `${dayFmt(w.date)} (${PART_LABEL[w.part].toLowerCase()})`).join(", ")}</dd></div>
                      <div className="rounded-2xl bg-surface/80 px-3 py-2"><dt className="text-xs text-muted">Duration · estimate</dt><dd className="font-semibold text-ink tabular">{r.minutes} min · {r.estimateCents !== null ? `${r.estimateFrom ? "from " : ""}${formatAud(r.estimateCents)}` : "—"}</dd></div>
                    </dl>
                    {r.notes ? <p className="rounded-2xl bg-surface/80 px-3 py-2 text-sm text-ink"><span className="text-xs text-muted">Customer notes: </span>{r.notes}</p> : null}
                    {r.pet.ownerNotes ? <p className="rounded-2xl bg-surface/80 px-3 py-2 text-sm whitespace-pre-line text-ink"><span className="text-xs text-muted">From the owner&apos;s pet profile: </span>{r.pet.ownerNotes}</p> : null}
                    {r.status === "open" ? (
                      <div className="flex flex-col gap-2 border-t border-ink/10 pt-3">
                        <p className="text-sm font-semibold text-ink">
                          On the shift board{r.assignedGroomerId ? ` for ${nameOf(r.assignedGroomerId) ?? "one groomer"}` : " for any eligible groomer"}
                          {r.acceptDeadline ? ` · until ${fmt(r.acceptDeadline)}` : ""}
                        </p>
                        {canReview ? <CloseRequest slug={slug} requestId={r.id} /> : null}
                      </div>
                    ) : canReview ? (
                      <ReviewControls acceptHours={allocation.acceptHours} slug={slug} requestId={r.id} team={groomers} defaultDate={pref?.date ?? r.windows[0]?.date ?? ""} defaultTime={pref ? minutesToHhmm(pref.minutes) : r.windows[0]?.part === "afternoon" ? "13:00" : "09:00"} />
                    ) : (
                      <p className="text-sm text-muted">The front desk confirms requests.</p>
                    )}
                  </article>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState art={<Mascot name="luna" mood="happy" className="w-28" />} title="No requests waiting" description="When pet owners send booking requests through your Lyra Pet listing, they land here for you to confirm." />
        )}
      </section>
      {recent.length ? (
        <section aria-labelledby="recent" className="flex flex-col gap-2">
          <h2 id="recent" className="font-display text-xl font-semibold text-ink">Recently handled</h2>
          <ul className="flex flex-col gap-1.5">
            {recent.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-surface px-4 py-2.5 text-sm shadow-[var(--shadow-card)]">
                <span className="font-semibold text-ink">{r.pet.name}</span>
                <span className="text-muted">{r.services.join(", ")}</span>
                <Badge tone={STATUS_TEXT[r.status]?.tone ?? "neutral"}>{STATUS_TEXT[r.status]?.label ?? r.status}</Badge>
                {r.acceptedBy ? <span className="text-muted">Accepted by {nameOf(r.acceptedBy)}</span> : null}
                {r.appointmentId ? <Link href={`/b/${slug}/appointments/${r.appointmentId}`} className="ml-auto font-semibold text-primary-text hover:underline">Open appointment</Link> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
