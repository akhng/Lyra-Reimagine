import { CalendarHeart, Camera, ClipboardList, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@lyra/ui";
import { getSessionUser } from "@lyra/platform/auth/session";
import { Brand } from "@/components/Brand";
import { Mascot, type MascotName } from "@/components/mascots/Mascot";

const FEATURES: Array<{ icon: typeof CalendarHeart; title: string; body: string; tint: string; mascot: MascotName }> = [
  { icon: CalendarHeart, title: "Bookings without the juggling", body: "Online booking, repeat appointments and a calendar that never double-books a groomer.", tint: "bg-primary-tint", mascot: "coco" },
  { icon: ClipboardList, title: "Every pet, remembered", body: "Coat, cut, products, temperament and care notes in one profile the whole team can see.", tint: "bg-mint-tint", mascot: "mochi" },
  { icon: Camera, title: "Before and after, side by side", body: "See exactly how each pet was groomed last time, with photos, before you start.", tint: "bg-coral-tint", mascot: "biscuit" },
  { icon: ShieldCheck, title: "Private by design", body: "Each business sees only its own customers, and groomers see pets, not contact details.", tint: "bg-sky-tint", mascot: "luna" },
];

/** Public landing page (ADR 0003): warm, illustrated, honest about what the product does today. */
export default async function Landing() {
  const user = await getSessionUser();
  return (
    <div className="min-h-dvh overflow-x-hidden">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Brand />
        <nav className="flex items-center gap-2">
          {user ? (
            <Link href="/home" className={buttonVariants({ size: "sm" })}>
              Open Lyra Pet
            </Link>
          ) : (
            <>
              <Link href="/login" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                Sign in
              </Link>
              <Link href="/signup" className={buttonVariants({ size: "sm" })}>
                Get started
              </Link>
            </>
          )}
        </nav>
      </header>
      <main id="main">
        <section className="relative mx-auto grid max-w-6xl items-center gap-10 px-6 pt-8 pb-20 lg:grid-cols-[1.1fr_1fr] lg:pt-16">
          <div aria-hidden className="absolute -top-20 -right-40 -z-10 size-[560px] rounded-full bg-primary-tint opacity-70 blur-3xl" />
          <div aria-hidden className="absolute bottom-0 -left-40 -z-10 size-[420px] rounded-full bg-coral-tint opacity-80 blur-3xl" />
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-butter-tint px-3 py-1 text-sm font-bold text-ink">For grooming salons, mobile groomers and the pets they love</p>
            <h1 className="mt-5 font-display text-5xl leading-[1.02] font-bold text-ink sm:text-7xl">
              Happy pets.
              <br />
              <span className="text-primary-text">Happy groomers.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted">Lyra Pet keeps bookings, pet profiles, grooming history and before-and-after photos in one cheerful place, so your team spends less time on admin and more time with the animals.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={user ? "/home" : "/signup"} className={buttonVariants({ size: "lg" })}>
                {user ? "Open Lyra Pet" : "Start your free trial"}
              </Link>
              {user ? null : (
                <Link href="/login" className={buttonVariants({ variant: "secondary", size: "lg" })}>
                  Sign in
                </Link>
              )}
            </div>
          </div>
          <div aria-hidden className="relative mx-auto grid w-full max-w-md grid-cols-2 gap-4">
            <div className="col-span-2 flex justify-center rounded-[32px] bg-primary-tint p-6 shadow-[var(--shadow-card)]">
              <Mascot name="coco" mood="excited" pose="wave" className="w-56 animate-bob" />
            </div>
            <div className="flex justify-center rounded-[28px] bg-mint-tint p-4 shadow-[var(--shadow-card)]">
              <Mascot name="mochi" mood="happy" className="w-32" />
            </div>
            <div className="flex justify-center rounded-[28px] bg-coral-tint p-4 shadow-[var(--shadow-card)]">
              <Mascot name="biscuit" mood="excited" className="w-32" />
            </div>
          </div>
        </section>

        <section aria-labelledby="features" className="mx-auto max-w-6xl px-6 pb-20">
          <h2 id="features" className="font-display text-3xl font-bold text-ink sm:text-4xl">
            Everything a grooming business needs
          </h2>
          <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <li key={f.title} className={`lift relative overflow-hidden rounded-[var(--radius-card)] ${f.tint} p-6 pb-20`}>
                <f.icon className="size-7 text-ink" aria-hidden />
                <h3 className="mt-4 font-display text-xl font-semibold text-ink">{f.title}</h3>
                <p className="mt-1 text-sm text-ink/80">{f.body}</p>
                <Mascot name={f.mascot} pose="peek" mood="curious" className="absolute -right-4 -bottom-6 w-24 opacity-90" />
              </li>
            ))}
          </ul>
        </section>

        <section className="mx-4 mb-16 rounded-[40px] bg-ink px-6 py-14 text-white sm:mx-6">
          <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 text-center sm:flex-row sm:text-left">
            <Mascot name="luna" mood="proud" className="w-36 shrink-0" />
            <div>
              <h2 className="font-display text-3xl font-bold">Your salon, but calmer.</h2>
              <p className="mt-2 max-w-xl text-ink-text">Set up your services, prices and hours in minutes, then share your booking link. Coco, Mochi, Biscuit and Luna will keep you company.</p>
            </div>
            <Link href={user ? "/home" : "/signup"} className={`${buttonVariants({ variant: "coral", size: "lg" })} sm:ml-auto`}>
              {user ? "Open Lyra Pet" : "Get started free"}
            </Link>
          </div>
        </section>
      </main>
      <footer className="mx-auto max-w-6xl px-6 py-8 text-sm text-muted">Lyra Pet is part of Lyra Reimagine. Coco, Mochi, Biscuit and Luna are original Lyra Pet characters.</footer>
    </div>
  );
}
