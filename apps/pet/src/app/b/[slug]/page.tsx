import type { Metadata } from "next";
import { CalendarClock, CheckCircle2, Circle, Moon, PawPrint, Scissors, Sparkles, Users, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { Card, CardDescription, CardTitle } from "@lyra/ui";
import { createSupabaseServerClient } from "@lyra/platform/supabase/server";
import { requireBusiness } from "@lyra/platform/tenancy/context";
import { searchCustomers } from "@/features/customers/queries";
import { segmentsFor } from "@/features/customers/schemas";
import { localDate } from "@/lib/dates";

export const metadata: Metadata = { title: "Dashboard" };

function greeting(timezone: string, now = new Date()): string {
  const hour = Number(new Intl.DateTimeFormat("en-AU", { hour: "numeric", hourCycle: "h23", timeZone: timezone }).format(now));
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

/**
 * Dashboard: KPIs and set-up steps, all counted from real records (no sample
 * numbers). Appointment KPIs and the day's timeline arrive with scheduling.
 */
export default async function Dashboard({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { business } = await requireBusiness(slug);
  const db = await createSupabaseServerClient();
  const todayIso = localDate(business.timezone);
  const monthStart = `${todayIso.slice(0, 8)}01`;
  const [{ count: locations }, { count: pets }, { count: groomsThisMonth }, { count: services }, directory] = await Promise.all([
    db.from("locations").select("id", { count: "exact", head: true }).eq("business_id", business.id).is("archived_at", null),
    db.from("pets").select("id", { count: "exact", head: true }).eq("business_id", business.id).is("archived_at", null),
    db.from("grooming_records").select("id", { count: "exact", head: true }).eq("business_id", business.id).gte("groomed_on", monthStart),
    db.from("services").select("id", { count: "exact", head: true }).eq("business_id", business.id).eq("active", true),
    searchCustomers(business.id, ""),
  ]);
  const segments = directory.map((c) => segmentsFor(c, todayIso));
  const count = (s: string) => segments.filter((x) => x.includes(s as never)).length;
  const today = new Intl.DateTimeFormat("en-AU", { weekday: "long", day: "numeric", month: "long", timeZone: business.timezone }).format(new Date());
  const kpis: Array<{ label: string; value: number; icon: LucideIcon; href: string }> = [
    { label: "Customers", value: directory.length, icon: Users, href: `/b/${slug}/customers` },
    { label: "New in the last 30 days", value: count("new"), icon: Sparkles, href: `/b/${slug}/customers?segment=new` },
    { label: "Pets", value: pets ?? 0, icon: PawPrint, href: `/b/${slug}/pets` },
    { label: "Grooms this month", value: groomsThisMonth ?? 0, icon: Scissors, href: `/b/${slug}/grooming` },
    { label: "Due for a groom", value: count("due"), icon: CalendarClock, href: `/b/${slug}/customers?segment=due` },
    { label: "Inactive (90+ days)", value: count("inactive"), icon: Moon, href: `/b/${slug}/customers?segment=inactive` },
  ];
  const steps = [
    { done: !!business.abn, label: "Add your ABN and GST status", href: `/b/${slug}/settings#details` },
    { done: (locations ?? 0) > 0, label: "Set up your locations", href: `/b/${slug}/settings#locations` },
    { done: (services ?? 0) > 0, label: "Add your services and prices", href: `/b/${slug}/services` },
    { done: directory.length > 0, label: "Add your first customer and pet", href: `/b/${slug}/customers/new` },
  ];
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <header>
        <p className="text-sm text-muted">{business.name} · {today}</p>
        <h1 className="font-display text-3xl font-bold text-navy">{greeting(business.timezone)}</h1>
      </header>
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-3" aria-label="Key numbers">
        {kpis.map((k) => (
          <li key={k.label}>
            <Link href={k.href} className="block h-full rounded-[var(--radius-card)] border border-border bg-surface p-4 shadow-[var(--shadow-card)] hover:border-primary">
              <k.icon className="size-5 text-primary-text" aria-hidden />
              <span className="mt-3 block font-display text-2xl font-semibold tabular">{k.value}</span>
              <span className="block text-sm text-muted">{k.label}</span>
            </Link>
          </li>
        ))}
      </ul>
      {steps.every((x) => x.done) ? null : (
      <Card aria-labelledby="setup-title">
        <CardTitle id="setup-title">Get set up</CardTitle>
        <CardDescription>A couple of details before you take bookings.</CardDescription>
        <ul className="mt-4 flex flex-col gap-1">
          {steps.map((s) => (
            <li key={s.label}>
              <Link href={s.href} className="flex items-center gap-3 rounded-[var(--radius-control)] p-2 text-sm hover:bg-surface-2">
                {s.done ? <CheckCircle2 className="size-5 text-success" aria-label="Done" /> : <Circle className="size-5 text-muted" aria-label="Not done yet" />}
                <span className={s.done ? "text-muted line-through" : undefined}>{s.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
      )}
    </div>
  );
}
