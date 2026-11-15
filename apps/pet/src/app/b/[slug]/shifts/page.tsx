import type { Metadata } from "next";
import { Clock, Coins, Timer } from "lucide-react";
import Link from "next/link";
import { Badge, Card, CardTitle, EmptyState } from "@lyra/ui";
import { createSupabaseServerClient } from "@lyra/platform/supabase/server";
import { requireBusiness } from "@lyra/platform/tenancy/context";
import { Mascot } from "@/components/mascots/Mascot";
import { PageHeader } from "@/components/PageHeader";
import { PetAvatar } from "@/components/PetAvatar";
import { AcceptButton } from "@/components/shifts/AcceptButton";
import { MyHoursForm } from "@/components/shifts/MyHoursForm";
import { PART_LABEL } from "@/features/portal/schemas";
import { appointmentsBetween } from "@/features/scheduling/queries";
import { isoFromNow } from "@/features/scheduling/time";
import { formatAud } from "@/features/services/pricing";
import { shiftBoard } from "@/features/shifts/queries";

export const metadata: Metadata = { title: "Shift board" };
const TINTS = ["bg-primary-tint", "bg-mint-tint", "bg-coral-tint", "bg-sky-tint", "bg-butter-tint"];

/** The groomers' shift board (ADR 0003): open grooming requests as cards, with Accept; then my upcoming appointments. */
export default async function Shifts({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { business, role, userId } = await requireBusiness(slug);
  const tz = business.timezone;
  const db = await createSupabaseServerClient();
  const [cards, { data: me }, { data: policy }, { data: location }] = await Promise.all([
    shiftBoard(business.id),
    db.from("business_members").select("id").eq("business_id", business.id).eq("user_id", userId).single(),
    db.from("booking_policies").select("groomers_set_own_hours").eq("business_id", business.id).maybeSingle(),
    db.from("locations").select("id").eq("business_id", business.id).is("archived_at", null).eq("is_mobile", false).order("created_at").limit(1).maybeSingle(),
  ]);
  const [mine, { data: myHours }] = await Promise.all([
    appointmentsBetween(business.id, isoFromNow(0), isoFromNow(14 * 24 * 60)).then((all) => all.filter((a) => a.groomerId === me?.id)),
    db.from("staff_hours").select("weekday, starts, ends").eq("member_id", me?.id ?? "").eq("location_id", location?.id ?? ""),
  ]);
  const fmt = (iso: string) => new Intl.DateTimeFormat("en-AU", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: tz }).format(new Date(iso));
  const dayFmt = (d: string) => new Intl.DateTimeFormat("en-AU", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));
  const groomsHere = role !== "receptionist";
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <PageHeader title="Shift board" description="Grooming requests waiting for a groomer. Accept one and it goes straight into your calendar." />
      <section aria-labelledby="available" className="flex flex-col gap-3">
        <h2 id="available" className="font-display text-2xl font-semibold text-ink">
          Available grooming requests {cards.length ? <span className="text-muted">({cards.length})</span> : null}
        </h2>
        {!groomsHere ? (
          <p className="text-sm text-muted">The shift board is for groomers. Open requests are also listed under Requests.</p>
        ) : cards.length ? (
          <ul className="grid gap-4 md:grid-cols-2">
            {cards.map((c, i) => (
              <li key={c.id}>
                <article className={`lift flex h-full flex-col gap-3 rounded-[var(--radius-card)] p-5 shadow-[var(--shadow-card)] ${TINTS[i % TINTS.length]}`}>
                  <div className="flex items-center gap-4">
                    <PetAvatar url={c.photoUrl} species={c.species} name={c.petName} size="lg" alt={c.photoUrl ? `Photo of ${c.petName}` : ""} />
                    <div className="min-w-0">
                      <h3 className="font-display text-2xl leading-tight font-bold text-ink">
                        {c.petName} <span className="text-lg font-semibold text-ink/70">· {c.breed ?? (c.species === "cat" ? "Cat" : "Dog")}</span>
                      </h3>
                      <p className="font-semibold text-ink">{c.services.join(", ")}</p>
                      {c.assignedToMe ? <Badge tone="primary">Assigned to you</Badge> : null}
                    </div>
                  </div>
                  <ul className="grid grid-cols-2 gap-2 text-sm">
                    <li className="col-span-2 flex items-center gap-2 rounded-2xl bg-surface/80 px-3 py-2 font-semibold text-ink">
                      <Clock className="size-4 shrink-0" aria-hidden /> {c.preferredStart ? fmt(c.preferredStart) : `Flexible: ${c.windows.map((w) => `${dayFmt(w.date)} ${PART_LABEL[w.part].toLowerCase()}`).join(", ")}`}
                    </li>
                    <li className="flex items-center gap-2 rounded-2xl bg-surface/80 px-3 py-2 text-ink">
                      <Timer className="size-4 shrink-0" aria-hidden /> About {c.minutes} min
                    </li>
                    <li className="flex items-center gap-2 rounded-2xl bg-surface/80 px-3 py-2 text-ink">
                      <Coins className="size-4 shrink-0" aria-hidden /> {c.commissionCents !== null ? `You earn ~${formatAud(c.commissionCents)}` : c.estimateCents !== null ? `${c.estimateFrom ? "From " : ""}${formatAud(c.estimateCents)}` : "Price at salon"}
                    </li>
                    {c.size ? <li className="rounded-2xl bg-surface/80 px-3 py-2 text-ink capitalize">Size: {c.size}</li> : null}
                    {c.deadline ? <li className="rounded-2xl bg-surface/80 px-3 py-2 text-ink">Accept by {fmt(c.deadline)}</li> : null}
                  </ul>
                  {c.notes ? <p className="rounded-2xl bg-surface/80 px-3 py-2 text-sm text-ink"><span className="text-xs text-muted">Customer instructions: </span>{c.notes}</p> : null}
                  {c.ownerNotes ? <p className="rounded-2xl bg-surface/80 px-3 py-2 text-sm whitespace-pre-line text-ink"><span className="text-xs text-muted">From the pet&apos;s profile: </span>{c.ownerNotes}</p> : null}
                  <div className="mt-auto">
                    <AcceptButton slug={slug} requestId={c.id} fixed={!!c.preferredStart} starts={c.starts} tz={tz} />
                  </div>
                </article>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState art={<Mascot name="biscuit" mood="sleepy" className="w-28" />} title="No open requests right now" description="When a request is opened to groomers you'll see it here, and get a notification." />
        )}
      </section>

      {groomsHere ? (
        <section aria-labelledby="mine" className="flex flex-col gap-3">
          <h2 id="mine" className="font-display text-2xl font-semibold text-ink">My next two weeks</h2>
          {mine.length ? (
            <ul className="flex flex-col gap-2">
              {mine.map((a) => (
                <li key={a.id}>
                  <Link href={`/b/${slug}/appointments/${a.id}`} className="lift flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] bg-surface p-4 shadow-[var(--shadow-card)]">
                    <span className="w-40 shrink-0 font-bold text-ink tabular">{fmt(a.startsAt)}</span>
                    <span className="min-w-0 flex-1 font-semibold text-ink">
                      {a.petName} <span className="font-normal text-muted">· {a.services.join(", ")}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Nothing in your calendar for the next two weeks.</p>
          )}
        </section>
      ) : null}

      {groomsHere && policy?.groomers_set_own_hours && location ? (
        <Card aria-labelledby="hours-title">
          <CardTitle id="hours-title">My working hours</CardTitle>
          <p className="text-sm text-muted">Requests only offer you times inside these hours.</p>
          <div className="mt-4">
            <MyHoursForm slug={slug} locationId={location.id} hours={(myHours ?? []).map((h) => ({ weekday: h.weekday, starts: h.starts.slice(0, 5), ends: h.ends.slice(0, 5) }))} />
          </div>
        </Card>
      ) : null}
    </div>
  );
}
