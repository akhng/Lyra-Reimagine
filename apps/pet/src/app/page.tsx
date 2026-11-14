import { CalendarCheck, Camera, PawPrint, Sparkles } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@lyra/ui";
import { getSessionUser } from "@lyra/platform/auth/session";
import { Brand } from "@/components/Brand";

const FEATURES = [
  { icon: CalendarCheck, title: "Bookings that run themselves", body: "Online booking, repeat appointments and reminders, with no double-bookings." },
  { icon: PawPrint, title: "Every pet, remembered", body: "Coat, cut, products, behaviour and care notes in one profile for the whole team." },
  { icon: Camera, title: "Before and after, side by side", body: "See exactly how each pet was groomed last time before you start." },
  { icon: Sparkles, title: "An assistant that knows your salon", body: "Lyra suggests who's due for a groom and drafts the message for you to approve." },
];

/** Public landing page. Signed-in staff go straight to their business. */
export default async function Landing() {
  const user = await getSessionUser();
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Brand />
        <nav className="flex items-center gap-2">
          {user ? (
            <Link href="/home" className={buttonVariants({ size: "sm" })}>
              Open your business
            </Link>
          ) : (
            <>
              <Link href="/login" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                Sign in
              </Link>
              <Link href="/signup" className={buttonVariants({ size: "sm" })}>
                Start free trial
              </Link>
            </>
          )}
        </nav>
      </header>
      <main id="main">
        <section className="mx-auto max-w-6xl px-6 pt-10 pb-16 sm:pt-20">
          <p className="text-sm font-semibold text-primary-text">For independent groomers, salons and mobile groomers</p>
          <h1 className="mt-3 max-w-3xl font-display text-4xl leading-tight font-bold text-navy sm:text-6xl">Spend less time managing your business and more time caring for pets.</h1>
          <p className="mt-5 max-w-2xl text-lg text-muted">Lyra Pet brings bookings, customers, pet profiles, grooming history, payments and reminders into one calm place, built for Australian grooming businesses.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={user ? "/home" : "/signup"} className={buttonVariants({ size: "lg" })}>
              {user ? "Open your business" : "Start your free trial"}
            </Link>
          </div>
        </section>
        <section aria-labelledby="features" className="bg-navy py-16 text-white">
          <div className="mx-auto max-w-6xl px-6">
            <h2 id="features" className="font-display text-2xl font-bold">
              Everything a grooming business needs
            </h2>
            <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map((f) => (
                <li key={f.title} className="rounded-[var(--radius-card)] border border-white/10 bg-white/5 p-5">
                  <f.icon className="size-6 text-navy-accent" aria-hidden />
                  <h3 className="mt-3 font-display font-semibold">{f.title}</h3>
                  <p className="mt-1 text-sm text-navy-text">{f.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>
      <footer className="mx-auto max-w-6xl px-6 py-8 text-sm text-muted">Lyra Pet is part of Lyra Reimagine.</footer>
    </div>
  );
}
