import { CalendarClock, Scissors } from "lucide-react";
import Link from "next/link";
import { PetAvatar } from "@/components/PetAvatar";
import type { MyAppointment, OwnerPet } from "@/features/portal/queries";
import { ageLabel } from "@/features/portal/schemas";

const TINTS = ["bg-primary-tint", "bg-mint-tint", "bg-coral-tint", "bg-sky-tint", "bg-butter-tint"];
const when = (iso: string, tz: string) => new Intl.DateTimeFormat("en-AU", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: tz }).format(new Date(iso));
const day = (iso: string, tz: string) => new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: tz }).format(new Date(iso));

/** An illustrated pet profile card: photo first, then the essentials and what's next. */
export function PetCard({ pet, index, next, last }: { pet: OwnerPet; index: number; next: MyAppointment | null; last: MyAppointment | null }) {
  const age = ageLabel(pet.dateOfBirth, pet.estimatedAge);
  return (
    <article className={`lift relative flex h-full flex-col gap-3 overflow-hidden rounded-[var(--radius-card)] p-5 shadow-[var(--shadow-card)] ${TINTS[index % TINTS.length]}`}>
      <div className="flex items-center gap-4">
        <PetAvatar url={pet.photoUrl} species={pet.species} name={pet.name} size="lg" alt={pet.photoUrl ? `Photo of ${pet.name}` : ""} />
        <div className="min-w-0">
          <h3 className="font-display text-2xl leading-tight font-bold text-ink">
            <Link href={`/me/pets/${pet.id}`} className="after:absolute after:inset-0 after:content-[''] hover:underline">
              {pet.name}
            </Link>
          </h3>
          <p className="text-sm font-semibold text-ink/80">{[pet.breed ?? (pet.species === "cat" ? "Cat" : pet.species === "dog" ? "Dog" : "Pet"), age].filter(Boolean).join(" · ")}</p>
        </div>
      </div>
      <dl className="grid gap-1.5 text-sm">
        <div className="flex items-center gap-2 rounded-2xl bg-surface/80 px-3 py-2">
          <CalendarClock className="size-4 shrink-0 text-ink" aria-hidden />
          <dt className="sr-only">Next appointment</dt>
          <dd className="text-ink">{next ? `${when(next.startsAt, next.timezone)} · ${next.businessName}` : "No appointment booked"}</dd>
        </div>
        <div className="flex items-center gap-2 rounded-2xl bg-surface/80 px-3 py-2">
          <Scissors className="size-4 shrink-0 text-ink" aria-hidden />
          <dt className="sr-only">Last groom</dt>
          <dd className="text-ink">{last ? `Last groomed ${day(last.startsAt, last.timezone)}` : "No grooms yet"}</dd>
        </div>
      </dl>
      {pet.groomingPreferences || pet.careNotes ? (
        <p className="line-clamp-2 text-sm text-ink/80">{[pet.groomingPreferences, pet.careNotes].filter(Boolean).join(" · ")}</p>
      ) : null}
    </article>
  );
}
