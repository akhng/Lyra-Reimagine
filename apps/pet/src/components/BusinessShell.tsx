"use client";
import { CalendarDays, LayoutDashboard, ListTodo, LogOut, Menu, PawPrint, Scissors, Settings, Tags, Users, X, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { cn } from "@lyra/ui";
import { signOutAction } from "@/features/auth/actions";
import { Brand } from "./Brand";
import { Mascot } from "./mascots/Mascot";

/**
 * Staff navigation for one business. Sections appear as each phase ships
 * (payments and team next); nothing links to an unfinished page.
 */
type Item = { href: string; label: string; icon: LucideIcon; exact?: boolean };

export function BusinessShell({ slug, businessName, role, children }: { slug: string; businessName: string; role: string; children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items: Item[] = [
    { href: `/b/${slug}`, label: "Dashboard", icon: LayoutDashboard, exact: true },
    { href: `/b/${slug}/calendar`, label: "Calendar", icon: CalendarDays },
    { href: `/b/${slug}/customers`, label: "Customers", icon: Users },
    { href: `/b/${slug}/pets`, label: "Pets", icon: PawPrint },
    { href: `/b/${slug}/grooming`, label: "Grooming records", icon: Scissors },
    { href: `/b/${slug}/services`, label: "Services & pricing", icon: Tags },
    { href: `/b/${slug}/waitlist`, label: "Waitlist", icon: ListTodo },
    { href: `/b/${slug}/settings`, label: "Settings", icon: Settings },
  ];
  const active = (i: Item) => (i.exact ? pathname === i.href : pathname === i.href || pathname.startsWith(`${i.href}/`));
  const nav = (
    <nav aria-label="Main" className="flex flex-col gap-1">
      {items.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          onClick={() => setOpen(false)}
          aria-current={active(i) ? "page" : undefined}
          className={cn("flex h-11 items-center gap-3 rounded-full px-4 text-sm font-semibold transition-[background-color,transform] duration-200 hover:translate-x-0.5", active(i) ? "bg-primary text-white shadow-[0_8px_20px_-10px_var(--primary)]" : "text-ink-text hover:bg-white/8 hover:text-white")}
        >
          <i.icon className="size-5 shrink-0" aria-hidden /> {i.label}
        </Link>
      ))}
    </nav>
  );
  const footer = (
    <div className="border-t border-white/10 pt-4">
      <p className="truncate text-sm font-semibold text-white">{businessName}</p>
      <p className="text-xs text-ink-text capitalize">{role}</p>
      <div className="mt-3 flex items-center gap-3 text-sm">
        <Link href="/home" className="text-ink-accent hover:underline">
          Switch business
        </Link>
        <form action={signOutAction}>
          <button type="submit" className="inline-flex items-center gap-1 text-ink-text hover:text-white">
            <LogOut className="size-4" aria-hidden /> Sign out
          </button>
        </form>
      </div>
    </div>
  );
  return (
    <div className="min-h-dvh lg:flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-[var(--radius-control)] focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-contrast">
        Skip to content
      </a>
      <aside className="sticky top-0 hidden h-dvh w-68 shrink-0 flex-col gap-6 rounded-r-[32px] bg-ink p-5 lg:flex">
        <Brand href={`/b/${slug}`} inverted />
        <div className="flex-1">{nav}</div>
        <div aria-hidden className="relative -mb-2 flex justify-center">
          <Mascot name="mochi" mood="sleepy" pose="peek" className="w-24 animate-bob" />
        </div>
        {footer}
      </aside>
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between bg-ink px-4 lg:hidden">
        <Brand href={`/b/${slug}`} inverted />
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="mobile-nav" className="grid size-11 place-items-center text-white" aria-label={open ? "Close menu" : "Open menu"}>
          {open ? <X className="size-6" aria-hidden /> : <Menu className="size-6" aria-hidden />}
        </button>
      </header>
      {open ? (
        <div id="mobile-nav" className="fixed inset-x-0 top-14 z-30 flex flex-col gap-6 bg-ink p-5 pb-8 lg:hidden">
          {nav}
          {footer}
        </div>
      ) : null}
      <main id="main" tabIndex={-1} className="min-w-0 flex-1 px-4 py-6 outline-none sm:px-6 lg:px-10 lg:py-8">
        {children}
      </main>
    </div>
  );
}
