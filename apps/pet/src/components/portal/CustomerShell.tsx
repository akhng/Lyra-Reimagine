"use client";
import { CalendarHeart, Home, LogOut, PawPrint, Store, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@lyra/ui";
import { signOutAction } from "@/features/auth/actions";
import { Brand } from "../Brand";

/** Pet owner portal shell (ADR 0003): a light top bar on larger screens, a thumb-friendly tab bar on phones. */
type Item = { href: string; label: string; icon: LucideIcon; exact?: boolean };
const ITEMS: Item[] = [
  { href: "/me", label: "Home", icon: Home, exact: true },
  { href: "/me/book", label: "Book", icon: PawPrint },
  { href: "/me/bookings", label: "Bookings", icon: CalendarHeart },
  { href: "/me/salons", label: "Salons", icon: Store },
];

export function CustomerShell({ children, staff, bell }: { children: ReactNode; staff: boolean; bell?: ReactNode }) {
  const pathname = usePathname();
  const active = (i: Item) => (i.exact ? pathname === i.href : pathname === i.href || pathname.startsWith(`${i.href}/`));
  return (
    <div className="min-h-dvh pb-24 sm:pb-0">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-contrast">
        Skip to content
      </a>
      <header className="sticky top-0 z-30 border-b border-border/70 bg-bg/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <Brand href="/me" />
          <nav aria-label="Main" className="hidden items-center gap-1 sm:flex">
            {ITEMS.map((i) => (
              <Link key={i.href} href={i.href} aria-current={active(i) ? "page" : undefined} className={cn("inline-flex h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold", active(i) ? "bg-primary text-white" : "text-ink hover:bg-surface-2")}>
                <i.icon className="size-4" aria-hidden /> {i.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-1 text-sm">
            {bell}
            {staff ? (
              <Link href="/home" className="hidden h-11 items-center rounded-full px-3 font-semibold text-primary-text hover:bg-surface-2 sm:inline-flex">
                My business
              </Link>
            ) : null}
            <form action={signOutAction}>
              <button type="submit" className="inline-flex h-11 items-center gap-1 rounded-full px-3 font-semibold text-muted hover:bg-surface-2 hover:text-ink">
                <LogOut className="size-4" aria-hidden /> <span className="hidden sm:inline">Sign out</span>
                <span className="sr-only sm:hidden">Sign out</span>
              </button>
            </form>
          </div>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="mx-auto max-w-6xl px-4 py-6 outline-none sm:py-8">
        {children}
      </main>
      <nav aria-label="Main" className="fixed inset-x-3 bottom-3 z-30 grid grid-cols-4 rounded-full border border-border bg-surface/95 p-1.5 shadow-[var(--shadow-lift)] backdrop-blur sm:hidden">
        {ITEMS.map((i) => (
          <Link key={i.href} href={i.href} aria-current={active(i) ? "page" : undefined} className={cn("flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-full text-[11px] font-bold", active(i) ? "bg-primary text-white" : "text-ink")}>
            <i.icon className="size-5" aria-hidden /> {i.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
