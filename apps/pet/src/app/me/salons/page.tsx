import type { Metadata } from "next";
import { MapPin } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@lyra/ui";
import { Mascot } from "@/components/mascots/Mascot";
import { PageHeader } from "@/components/PageHeader";
import { FavouriteButton } from "@/components/portal/FavouriteButton";
import { listings, myFavourites } from "@/features/portal/queries";
import { formatAud } from "@/features/services/pricing";

export const metadata: Metadata = { title: "Salons" };
const TINTS = ["bg-primary-tint", "bg-mint-tint", "bg-coral-tint", "bg-sky-tint", "bg-butter-tint"];

/** Grooming salons listed on Lyra Pet; favourites first. */
export default async function Salons() {
  const [all, favourites] = await Promise.all([listings(), myFavourites()]);
  const sorted = [...all].sort((a, b) => Number(favourites.has(b.slug)) - Number(favourites.has(a.slug)));
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Grooming salons" description="Salons that take requests through Lyra Pet. Prices are estimates; the salon confirms." />
      {sorted.length ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((s, i) => (
            <li key={s.slug}>
              <article className={`lift relative flex h-full flex-col gap-3 overflow-hidden rounded-[var(--radius-card)] p-5 shadow-[var(--shadow-card)] ${TINTS[i % TINTS.length]}`}>
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-display text-xl leading-tight font-semibold text-ink">
                    <Link href={`/me/salons/${s.slug}`} className="after:absolute after:inset-0 after:content-[''] hover:underline">
                      {s.name}
                    </Link>
                  </h2>
                  <FavouriteButton slug={s.slug} name={s.name} initial={favourites.has(s.slug)} />
                </div>
                {s.headline ? <p className="text-sm text-ink/80">{s.headline}</p> : null}
                <p className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-semibold text-ink">
                  {s.suburb ? (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-4" aria-hidden /> {s.suburb}
                    </span>
                  ) : null}
                  <span>{s.services} services{s.fromCents !== null ? ` · from ${formatAud(s.fromCents)}` : ""}</span>
                  {!s.accepting ? <span className="text-muted">Not taking requests right now</span> : null}
                </p>
                <Mascot name={s.mascot} pose="peek" mood="happy" className="absolute -right-3 -bottom-4 w-20 opacity-90" />
              </article>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState art={<Mascot name="luna" mood="curious" className="w-28" />} title="No salons listed yet" description="Salons appear here once they switch on their Lyra Pet listing. If your groomer uses Lyra Pet, ask them for their booking link." />
      )}
    </div>
  );
}
