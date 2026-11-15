import type { Metadata } from "next";
import { AlertTriangle, CalendarClock, CalendarPlus, Pencil, Scissors } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, CardTitle, EmptyState, buttonVariants } from "@lyra/ui";
import { requireBusiness } from "@lyra/platform/tenancy/context";
import { GroomComparison, GroomHistory } from "@/components/grooming/GroomHistory";
import { PageHeader } from "@/components/PageHeader";
import { PetAvatar } from "@/components/PetAvatar";
import { PetPhotoUpload } from "@/components/pets/PetPhotoUpload";
import { petHistory } from "@/features/grooming/queries";
import { appointmentsForPet } from "@/features/scheduling/queries";
import { minutesToHhmm, toLocal } from "@/features/scheduling/time";
import { getPet } from "@/features/pets/queries";
import { ageLabel } from "@/features/pets/schemas";
import { listTeam } from "@/features/team/queries";
import { daysBetween, formatDay, localDate } from "@/lib/dates";
import { param, uuidOr404 } from "@/lib/params";
import { Mascot } from "@/components/mascots/Mascot";

export const metadata: Metadata = { title: "Pet" };

function addDays(iso: string, days: number) {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

function Facts({ items }: { items: Array<[string, string | number | null]> }) {
  const shown = items.filter(([, v]) => v !== null && v !== "");
  if (!shown.length) return <p className="mt-2 text-sm text-muted">Nothing recorded yet.</p>;
  return (
    <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
      {shown.map(([k, v]) => (
        <div key={k}>
          <dt className="text-muted">{k}</dt>
          <dd className="whitespace-pre-line">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export default async function PetProfile({ params, searchParams }: { params: Promise<{ slug: string; id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { slug, id: rawId } = await params;
  const sp = await searchParams;
  const id = uuidOr404(rawId);
  const { business } = await requireBusiness(slug);
  const [pet, records, team, upcoming] = await Promise.all([getPet(business.id, id), petHistory(business.id, id), listTeam(business.id), appointmentsForPet(business.id, id, new Date().toISOString())]);
  if (!pet) notFound();
  const today = localDate(business.timezone);
  const last = records[0];
  const due = last && pet.groom_interval_weeks ? addDays(last.groomed_on, pet.groom_interval_weeks * 7) : null;
  const dueIn = due ? daysBetween(today, due) : null;
  const age = ageLabel(pet.date_of_birth, pet.estimated_age_years, today);
  const careAlerts: Array<[string, string | null]> = [["Allergies", pet.allergies], ["Medical notes", pet.medical_notes], ["Handling precautions", pet.handling_precautions], ["Sensitivities", pet.sensitivities]];
  const hasAlerts = careAlerts.some(([, v]) => v);
  const groomerName = (mid: string | null) => team.find((m) => m.id === mid)?.name ?? null;
  const saved = param(sp.saved) === "groom";
  const partial = param(sp.photos) === "partial";
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <PageHeader
        back={{ href: `/b/${slug}/customers/${pet.customers.id}`, label: `${pet.customers.first_name} ${pet.customers.last_name ?? ""}`.trim() }}
        title={<span className="flex items-center gap-4"><PetAvatar url={pet.photoUrl} species={pet.species} size="lg" alt={pet.photoUrl ? `Photo of ${pet.name}` : ""} /> {pet.name}</span>}
        description={[pet.breed, pet.size, age, pet.sex !== "unknown" ? pet.sex : null].filter((s): s is string => !!s).map((s) => `${s[0]!.toUpperCase()}${s.slice(1)}`).join(" · ") || undefined}
        actions={
          <>
            <Link href={`/b/${slug}/appointments/new?customer=${pet.customers.id}&pet=${id}`} className={buttonVariants()}><CalendarPlus className="size-4" aria-hidden /> Book</Link>
            <Link href={`/b/${slug}/pets/${id}/groom`} className={buttonVariants({ variant: "secondary" })}><Scissors className="size-4" aria-hidden /> Record a groom</Link>
            <Link href={`/b/${slug}/pets/${id}/edit`} className={buttonVariants({ variant: "secondary" })}><Pencil className="size-4" aria-hidden /> Edit</Link>
          </>
        }
      />
      {saved ? <p role="status" className="rounded-[var(--radius-control)] bg-success-tint px-4 py-3 text-sm text-success">Grooming record saved.</p> : null}
      {partial ? <p role="alert" className="rounded-[var(--radius-control)] bg-warning-tint px-4 py-3 text-sm text-warning">The grooming record was saved, but some photos didn&apos;t upload. Please add them again from a new record or try later.</p> : null}
      <div className="flex flex-wrap items-center gap-3">
        <PetPhotoUpload slug={slug} businessId={business.id} petId={id} />
        {due ? (
          <Badge tone={dueIn !== null && dueIn <= 0 ? "warning" : "neutral"}>
            <CalendarClock className="size-3.5" aria-hidden /> {dueIn !== null && dueIn <= 0 ? `Due for a groom (since ${formatDay(due)})` : `Next groom due ${formatDay(due)}`}
          </Badge>
        ) : null}
      </div>
      {hasAlerts ? (
        <section aria-labelledby="care-title" className="rounded-[var(--radius-card)] border border-warning/40 bg-warning-tint p-5">
          <h2 id="care-title" className="flex items-center gap-2 font-display text-lg font-semibold text-warning"><AlertTriangle className="size-5" aria-hidden /> Care information</h2>
          <Facts items={careAlerts} />
        </section>
      ) : null}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card aria-labelledby="prefs-title">
          <CardTitle id="prefs-title">Grooming preferences</CardTitle>
          <Facts items={[["Preferred cut", pet.preferred_cut], ["Coat length", pet.coat_length], ["Style", pet.grooming_style], ["Shampoo", pet.shampoo], ["Finishing products", pet.finishing_products], ["Nails", pet.nail_preferences], ["Ears", pet.ear_cleaning], ["Noise sensitivity", pet.noise_sensitivity], ["Behaviour", pet.behaviour], ["Handling", pet.handling_preferences]]} />
        </Card>
        <Card aria-labelledby="about-title">
          <CardTitle id="about-title">About</CardTitle>
          <Facts items={[["Coat", [pet.coat_type, pet.coat_colour].filter(Boolean).join(", ") || null], ["Weight", pet.weight_kg ? `${pet.weight_kg} kg` : null], ["Date of birth", pet.date_of_birth ? formatDay(pet.date_of_birth) : null], ["Microchip", pet.microchip], ["Groom every", pet.groom_interval_weeks ? `${pet.groom_interval_weeks} weeks` : null], ["Skin and coat", pet.skin_coat_concerns], ["Emergency contact", pet.emergency_contact]]} />
        </Card>
      </div>
      {upcoming.length ? (
        <section aria-labelledby="upcoming-title" className="rounded-[var(--radius-card)] border border-border bg-surface p-5 shadow-[var(--shadow-card)]">
          <h2 id="upcoming-title" className="font-display text-lg font-semibold text-ink">Upcoming appointments</h2>
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {upcoming.map((a) => {
              const st = toLocal(Date.parse(a.startsAt), business.timezone);
              return <li key={a.id}><Link href={`/b/${slug}/appointments/${a.id}`} className="text-primary-text underline-offset-4 hover:underline">{formatDay(st.date)} at {minutesToHhmm(st.minutes)}</Link> · {a.services.join(", ")}</li>;
            })}
          </ul>
        </section>
      ) : null}
      <GroomComparison petName={pet.name} records={records} />
      <section aria-labelledby="history-title" className="flex flex-col gap-3">
        <h2 id="history-title" className="font-display text-xl font-semibold text-ink">Grooming history</h2>
        {records.length === 0 ? (
          <EmptyState art={<Mascot name="mochi" mood="curious" className="w-28" />} icon={<Scissors />} title="No grooms recorded yet" description="Record each groom with notes and before/after photos so the next groomer knows exactly what was done." action={<Link href={`/b/${slug}/pets/${id}/groom`} className={buttonVariants()}>Record a groom</Link>} />
        ) : (
          <GroomHistory petName={pet.name} records={records} groomerName={groomerName} />
        )}
      </section>
    </div>
  );
}
