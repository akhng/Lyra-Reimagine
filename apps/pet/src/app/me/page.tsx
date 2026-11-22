import type { Metadata } from "next";
import { CalendarHeart, Gift, Heart, History, PawPrint, Plus, Store, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { buttonVariants, EmptyState } from "@lyra/ui";
import { createSupabaseServerClient } from "@lyra/platform/supabase/server";
import { Mascot, type MascotName } from "@/components/mascots/Mascot";
import { mascotFor } from "@/components/PetAvatar";
import { PetCard } from "@/components/portal/PetCard";
import { myBookings, myFavourites, myOwnerPets } from "@/features/portal/queries";
import { groomStreak, levelFor } from "@/features/loyalty/engine";
import { myLoyalty } from "@/features/loyalty/queries";
import { localToday } from "@/features/scheduling/time";
import { ACTIVE_REQUEST } from "@/features/portal/schemas";
import { nowMs } from "@/features/scheduling/time";

export const metadata: Metadata = { title: "My pets" };

const COMPLIMENTS = ["is looking fabulous today!", "says hello!", "is ready for some pampering.", "is the goodest of pets.", "would love a fresh new look."];

/** The pet owner's home: a welcome, their pets as illustrated cards, then the things they can do (all real data). */
export default async function MeHome() {
  const db = await createSupabaseServerClient();
  const [{ data: auth }, pets, bookings, favourites, loyalty] = await Promise.all([db.auth.getClaims(), myOwnerPets(), myBookings(), myFavourites(), myLoyalty()]);
  const today = localToday("Australia/Melbourne");
  const points = loyalty.salons.filter((s) => s.enabled).reduce((n, s) => n + s.balance, 0);
  const lifetime = loyalty.salons.reduce((n, s) => n + s.lifetime, 0);
  const firstName = String(auth?.claims?.user_metadata?.full_name ?? "").split(" ")[0] || "there";
  const now = nowMs();
  const upcoming = bookings.appointments.filter((a) => Date.parse(a.startsAt) > now && !["cancelled", "no_show", "completed"].includes(a.status)).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const done = bookings.appointments.filter((a) => a.status === "completed");
  const openRequests = bookings.requests.filter((r) => ACTIVE_REQUEST.includes(r.status));
  const star = pets[new Date().getUTCDate() % Math.max(1, pets.length)];
  const mascot: MascotName = star ? mascotFor(star.species, star.name) : "coco";
  const tiles: Array<{ title: string; body: string; href: string; icon: LucideIcon; tint: string }> = [
    { title: "Book a grooming appointment", body: "Choose a pet, a salon and a time that suits you.", href: "/me/book", icon: PawPrint, tint: "bg-primary-tint" },
    { title: "Upcoming appointments", body: upcoming.length ? `${upcoming.length} booked${openRequests.length ? ` · ${openRequests.length} waiting for a reply` : ""}` : openRequests.length ? `${openRequests.length} request${openRequests.length === 1 ? "" : "s"} waiting for a reply` : "Nothing booked yet.", href: "/me/bookings", icon: CalendarHeart, tint: "bg-coral-tint" },
    { title: "Grooming history", body: done.length ? `${done.length} completed groom${done.length === 1 ? "" : "s"}` : "Your pets' grooms will collect here.", href: "/me/bookings#history", icon: History, tint: "bg-mint-tint" },
    { title: "Loyalty rewards", body: points || lifetime ? `${points} points · ${levelFor(lifetime).name}` : "Earn points every time a groom is completed.", href: "/me/rewards", icon: Gift, tint: "bg-butter-tint" },
    { title: "Favourite salons", body: favourites.size ? `${favourites.size} saved` : "Tap the heart on a salon to keep it handy.", href: "/me/salons", icon: Heart, tint: "bg-sky-tint" },
  ];
  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="welcome" className="relative overflow-hidden rounded-[32px] bg-glow p-6 sm:p-8">
        <div className="relative z-10 max-w-xl">
          <h1 id="welcome" className="font-display text-3xl font-bold text-ink sm:text-4xl">
            Welcome back, {firstName}!
          </h1>
          <p className="mt-2 text-lg font-semibold text-ink/80">{star ? `${star.name} ${COMPLIMENTS[new Date().getUTCDay() % COMPLIMENTS.length]}` : "Add your first pet to start booking grooms."}</p>
        </div>
        <Mascot name={mascot} mood="excited" pose="wave" className="absolute -right-2 -bottom-6 hidden w-40 sm:block" />
      </section>

      <section aria-labelledby="pets" className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <h2 id="pets" className="font-display text-2xl font-semibold text-ink">
            My pets
          </h2>
          <Link href="/me/pets/new" className={buttonVariants({ variant: "secondary", size: "sm" })}>
            <Plus aria-hidden /> Add a pet
          </Link>
        </div>
        {pets.length ? (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pets.map((p, i) => (
              <li key={p.id}>
                <PetCard pet={p} index={i} next={upcoming.find((a) => a.ownerPetId === p.id) ?? null} last={done.find((a) => a.ownerPetId === p.id) ?? null} streak={groomStreak(loyalty.groomDates.filter((g) => g.ownerPetId === p.id).map((g) => g.date), loyalty.groomDates.find((g) => g.ownerPetId === p.id)?.interval ?? null, today).current} badges={loyalty.petAwards.filter((a) => a.ownerPetId === p.id).length} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState art={<Mascot name="coco" mood="curious" className="w-28" />} title="No pets yet" description="Add your cat or dog with a photo, breed and any care notes. Salons you book with see what they need to groom safely." action={<Link href="/me/pets/new" className={buttonVariants()}>Add your first pet</Link>} />
        )}
      </section>

      <section aria-labelledby="todo" className="flex flex-col gap-4">
        <h2 id="todo" className="font-display text-2xl font-semibold text-ink">
          Things to do
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2">
          {tiles.map((t) => (
            <li key={t.title}>
              <Link href={t.href} className={`lift flex h-full items-start gap-4 rounded-[var(--radius-card)] p-5 shadow-[var(--shadow-card)] ${t.tint}`}>
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-surface/80 text-ink">
                  <t.icon className="size-6" aria-hidden />
                </span>
                <span>
                  <span className="block font-display text-lg font-semibold text-ink">{t.title}</span>
                  <span className="block text-sm text-ink/80">{t.body}</span>
                </span>
              </Link>
            </li>
          ))}
          <li>
            <Link href="/me/salons" className="lift flex h-full items-start gap-4 rounded-[var(--radius-card)] bg-butter-tint p-5 shadow-[var(--shadow-card)]">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-surface/80 text-ink">
                <Store className="size-6" aria-hidden />
              </span>
              <span>
                <span className="block font-display text-lg font-semibold text-ink">Browse salons</span>
                <span className="block text-sm text-ink/80">See services and prices from grooming salons on Lyra Pet.</span>
              </span>
            </Link>
          </li>
        </ul>
      </section>
    </div>
  );
}
