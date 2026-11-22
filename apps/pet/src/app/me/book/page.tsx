import type { Metadata } from "next";
import { Check, MapPin } from "lucide-react";
import Link from "next/link";
import { buttonVariants, cn, EmptyState } from "@lyra/ui";
import { Mascot } from "@/components/mascots/Mascot";
import { PageHeader } from "@/components/PageHeader";
import { PetAvatar } from "@/components/PetAvatar";
import { BookingWizard } from "@/components/portal/BookingWizard";
import { listing, listingPaysOnline, listings, myFavourites, myOwnerPets } from "@/features/portal/queries";
import { formatAud } from "@/features/services/pricing";

export const metadata: Metadata = { title: "Book a groom" };

/**
 * The booking request journey (ADR 0003). Steps 1–2 (pet, salon) are links,
 * so they work without JavaScript and keep their place in the address; steps
 * 3–7 run in the wizard.
 */
export default async function Book({ searchParams }: { searchParams: Promise<{ pet?: string; salon?: string }> }) {
  const sp = await searchParams;
  const [pets, salons, favourites] = await Promise.all([myOwnerPets(), listings(), myFavourites()]);
  const pet = pets.find((p) => p.id === sp.pet) ?? (pets.length === 1 ? pets[0] : undefined);
  const chosen = sp.salon ? await listing(sp.salon) : null;
  const q = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ pet: pet?.id, salon: chosen?.slug, ...over }).filter((e): e is [string, string] => !!e[1]));
    return `/me/book?${p.toString()}`;
  };
  // A salon can only take a request if it's accepting and has at least one service bookable online.
  const bookable = salons.filter((s) => s.accepting && s.services > 0);
  const steps = [
    { n: 1, label: "Pet", done: !!pet, value: pet?.name, href: q({ pet: undefined }) },
    { n: 2, label: "Salon", done: !!chosen, value: chosen?.name, href: q({ salon: undefined }) },
  ];
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader title="Book a groom" description="Send a request; the salon confirms a time with one of their groomers." back={{ href: "/me", label: "Home" }} />
      <ol className="flex flex-wrap gap-2" aria-label="Your choices">
        {steps.map((s) => (
          <li key={s.n}>
            {s.done ? (
              <Link href={s.href} className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-mint-tint px-4 text-sm font-bold text-success hover:underline">
                <Check className="size-4" aria-hidden /> {s.label}: {s.value} <span className="sr-only">(change)</span>
              </Link>
            ) : (
              <span className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-surface-2 px-4 text-sm font-bold text-muted">
                {s.n} {s.label}
              </span>
            )}
          </li>
        ))}
      </ol>

      {!pets.length ? (
        <EmptyState art={<Mascot name="coco" mood="curious" className="w-28" />} title="Add a pet first" description="Requests are for one of your pets, so the salon knows who's coming." action={<Link href="/me/pets/new" className={buttonVariants()}>Add a pet</Link>} />
      ) : !pet ? (
        <section aria-labelledby="choose-pet" className="flex flex-col gap-3">
          <h2 id="choose-pet" className="font-display text-xl font-semibold text-ink">1. Who&apos;s getting groomed?</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {pets.map((p) => (
              <li key={p.id}>
                <Link href={q({ pet: p.id })} className="lift flex items-center gap-4 rounded-[var(--radius-card)] bg-surface p-4 shadow-[var(--shadow-card)]">
                  <PetAvatar url={p.photoUrl} species={p.species} name={p.name} />
                  <span>
                    <span className="block font-display text-lg font-semibold text-ink">{p.name}</span>
                    <span className="block text-sm text-muted">{p.breed ?? (p.species === "cat" ? "Cat" : "Dog")}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : !chosen ? (
        <section aria-labelledby="choose-salon" className="flex flex-col gap-3">
          <h2 id="choose-salon" className="font-display text-xl font-semibold text-ink">2. Choose a salon</h2>
          {bookable.length ? (
            <ul className="grid gap-3 sm:grid-cols-2">
              {[...bookable].sort((a, b) => Number(favourites.has(b.slug)) - Number(favourites.has(a.slug))).map((s) => (
                <li key={s.slug}>
                  <Link href={q({ salon: s.slug })} className={cn("lift relative flex h-full flex-col gap-1 overflow-hidden rounded-[var(--radius-card)] bg-surface p-4 pr-20 shadow-[var(--shadow-card)]")}>
                    <span className="font-display text-lg font-semibold text-ink">{s.name}</span>
                    {s.suburb ? (
                      <span className="inline-flex items-center gap-1 text-sm text-muted">
                        <MapPin className="size-4" aria-hidden /> {s.suburb}
                      </span>
                    ) : null}
                    <span className="text-sm font-semibold text-ink">{s.fromCents !== null ? `From ${formatAud(s.fromCents)}` : `${s.services} services`}{favourites.has(s.slug) ? " · Favourite" : ""}</span>
                    <Mascot name={s.mascot} pose="peek" className="absolute -right-2 -bottom-3 w-16" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState art={<Mascot name="luna" mood="curious" className="w-28" />} title="No salons are taking requests yet" description="Salons appear here once they switch on their Lyra Pet listing." />
          )}
        </section>
      ) : !chosen.accepting || !chosen.services.length ? (
        <EmptyState art={<Mascot name="luna" mood="sleepy" className="w-28" />} title={`${chosen.name} isn't taking requests right now`} description={chosen.accepting ? "They haven't put any services up for online booking yet. Choose another salon, or try again later." : "Choose another salon, or try again later."} action={<Link href={q({ salon: undefined })} className={buttonVariants({ variant: "secondary" })}>Choose another salon</Link>} />
      ) : (
        <BookingWizard key={`${pet.id}-${chosen.slug}`} pet={pet} listing={chosen} payOnline={await listingPaysOnline(chosen.slug)} />
      )}
    </div>
  );
}
