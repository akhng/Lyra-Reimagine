import type { Metadata } from "next";
import { Clock, Phone } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonVariants, Card } from "@lyra/ui";
import { Mascot } from "@/components/mascots/Mascot";
import { PageHeader } from "@/components/PageHeader";
import { FavouriteButton } from "@/components/portal/FavouriteButton";
import { MessageSalonButton } from "@/components/messages/MessageSalonButton";
import { listing, myFavourites } from "@/features/portal/queries";
import { WEEKDAY_LABEL } from "@/features/scheduling/schemas";
import { formatAud } from "@/features/services/pricing";

export const metadata: Metadata = { title: "Salon" };

export default async function Salon({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [s, favourites] = await Promise.all([listing(slug), myFavourites()]);
  if (!s) notFound();
  const days = [1, 2, 3, 4, 5, 6, 7].map((d) => ({ d, spans: s.hours.filter((h) => h.weekday === d) }));
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={s.name} description={s.headline ?? undefined} back={{ href: "/me/salons", label: "Salons" }} actions={<div className="flex items-center gap-2"><FavouriteButton slug={s.slug} name={s.name} initial={favourites.has(s.slug)} /><MessageSalonButton slug={s.slug} name={s.name} />{s.accepting && s.services.length ? <Link href={`/me/book?salon=${s.slug}`} className={buttonVariants()}>Request a groom</Link> : null}</div>} />
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <h2 className="font-display text-xl font-semibold text-ink">Services and prices</h2>
          <p className="text-sm text-muted">Estimates. Size prices apply when your pet&apos;s size is known.</p>
          <ul className="mt-4 flex flex-col divide-y divide-border">
            {s.services.map((v) => (
              <li key={v.id} className="flex items-start justify-between gap-4 py-3">
                <span>
                  <span className="block font-bold text-ink">{v.name}</span>
                  <span className="block text-sm text-muted">{[v.description, `${v.minutes} min`].filter(Boolean).join(" · ")}</span>
                </span>
                <span className="shrink-0 font-display text-lg font-bold text-ink tabular">{v.priceFrom ? "from " : ""}{formatAud(v.priceCents)}</span>
              </li>
            ))}
          </ul>
        </Card>
        <div className="flex flex-col gap-4">
          <Card className="relative overflow-hidden bg-primary-tint">
            {s.about ? <p className="relative z-10 text-sm text-ink">{s.about}</p> : <p className="relative z-10 text-sm text-ink">{s.name} grooms cats and dogs{s.locations[0]?.suburb ? ` in ${s.locations[0].suburb}` : ""}.</p>}
            {s.phone ? (
              <p className="relative z-10 mt-3 inline-flex items-center gap-2 text-sm font-semibold text-ink">
                <Phone className="size-4" aria-hidden /> {s.phone}
              </p>
            ) : null}
            <Mascot name={s.mascot} mood="happy" className="mx-auto mt-2 w-28" />
          </Card>
          <Card>
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-ink">
              <Clock className="size-5" aria-hidden /> Opening hours
            </h2>
            <dl className="mt-3 grid grid-cols-[3rem_1fr] gap-y-1 text-sm">
              {days.map(({ d, spans }) => (
                <div key={d} className="contents">
                  <dt className="text-muted">{WEEKDAY_LABEL[d]?.slice(0, 3)}</dt>
                  <dd className="text-ink tabular">{spans.length ? spans.map((h) => `${h.opens}–${h.closes}`).join(", ") : "Closed"}</dd>
                </div>
              ))}
            </dl>
            {s.policy?.text ? <p className="mt-3 text-xs text-muted">{s.policy.text}</p> : null}
          </Card>
        </div>
      </div>
    </div>
  );
}
