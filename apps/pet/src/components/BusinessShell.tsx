"use client";
import { CalendarDays, ClipboardList, CreditCard, Heart, Inbox, LayoutDashboard, MessageCircle, Star, ListTodo, LogOut, Menu, PawPrint, Scissors, Settings, Tags, Users, X, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { cn } from "@lyra/ui";
import { signOutAction } from "@/features/auth/actions";
import { Brand } from "./Brand";
import { Mascot } from "./mascots/Mascot";

/**
 * Staff navigation for one business. Sections appear as each phase ships
 * (team next); nothing links to an unfinished page. Manage Payments is for
 * owners and managers only, matching who can see the page.
 */
type Item = { href: string; label: string; icon: LucideIcon; exact?: boolean };

export function BusinessShell({ slug, businessName, role, bell, unreadMessages = 0, children }: { slug: string; businessName: string; role: string; bell?: ReactNode; unreadMessages?: number; children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items: Item[] = [
    { href: `/b/${slug}`, label: "Dashboard", icon: LayoutDashboard, exact: true },
    { href: `/b/${slug}/calendar`, label: "Calendar", icon: CalendarDays },
    { href: `/b/${slug}/requests`, label: "Requests", icon: Inbox },
    { href: `/b/${slug}/messages`, label: "Messages", icon: MessageCircle },
    { href: `/b/${slug}/shifts`, label: "Shift board", icon: ClipboardList },
    { href: `/b/${slug}/customers`, label: "Customers", icon: Users },
    { href: `/b/${slug}/pets`, label: "Pets", icon: PawPrint },
    { href: `/b/${slug}/grooming`, label: "Grooming records", icon: Scissors },
    { href: `/b/${slug}/services`, label: "Services & pricing", icon: Tags },
    { href: `/b/${slug}/waitlist`, label: "Waitlist", icon: ListTodo },
    { href: `/b/${slug}/reviews`, label: "Reviews", icon: Star },
    ...(role === "owner" || role === "manager" ? [{ href: `/b/${slug}/payments`, label: "Manage Payments", icon: CreditCard }] : []),
  ];
  const active = (i: Item) => (i.exact ? pathname === i.href : pathname === i.href || pathname.startsWith(`${i.href}/`));
  // Settings sits beside the bell (not in the menu list), so the menu stays short and Sign out is always in view.
  const settingsHref = `/b/${slug}/settings`;
  const onSettings = pathname === settingsHref || pathname.startsWith(`${settingsHref}/`);
  const settings = (
    <Link
      href={settingsHref}
      onClick={() => setOpen(false)}
      aria-label="Settings"
      title="Settings"
      aria-current={onSettings ? "page" : undefined}
      className={cn("grid size-11 shrink-0 place-items-center rounded-full text-white transition-colors", onSettings ? "bg-primary shadow-[0_8px_20px_-10px_var(--primary)]" : "hover:bg-white/10")}
    >
      <Settings className="size-5" aria-hidden />
    </Link>
  );
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
          {i.href.endsWith("/messages") && unreadMessages > 0 ? (
            <span className="ml-auto rounded-full bg-coral px-2 text-xs font-bold text-ink tabular">
              {unreadMessages}
              <span className="sr-only"> unread</span>
            </span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
  const footer = (
    <div className="border-t border-white/10 pt-4">
      <p className="truncate text-sm font-semibold text-white">{businessName}</p>
      <p className="text-xs text-ink-text capitalize">{role}</p>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
        <Link href="/home" className="text-ink-accent hover:underline">
          Switch business
        </Link>
        <Link href="/me" className="inline-flex items-center gap-1 text-ink-accent hover:underline">
          <Heart className="size-4" aria-hidden /> My pets
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
        <div className="flex items-center justify-between gap-2">
          <Brand href={`/b/${slug}`} inverted />
          <div className="flex items-center gap-1">
            {bell}
            {settings}
          </div>
        </div>
        {/* The menu scrolls inside the sidebar if it can't fit, so the footer never spills onto the page. */}
        <div className="-mx-2 min-h-0 flex-1 overflow-y-auto px-2">{nav}</div>
        {/* Decoration only: dropped on shorter screens (e.g. 900px laptops) to leave room for the menu. */}
        <div aria-hidden className="relative -mb-2 flex justify-center [@media(max-height:959px)]:hidden">
          <Mascot name="mochi" mood="sleepy" pose="peek" className="w-24 animate-bob" />
        </div>
        {footer}
      </aside>
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between bg-ink px-4 lg:hidden">
        <Brand href={`/b/${slug}`} inverted />
        <div className="flex items-center gap-1">
          {bell}
          {settings}
          <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="mobile-nav" className="grid size-11 place-items-center text-white" aria-label={open ? "Close menu" : "Open menu"}>
            {open ? <X className="size-6" aria-hidden /> : <Menu className="size-6" aria-hidden />}
          </button>
        </div>
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
