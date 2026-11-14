import type { Metadata } from "next";
import { Building2, CheckCircle2, Circle, MapPin, Users } from "lucide-react";
import Link from "next/link";
import { Card, CardDescription, CardTitle } from "@lyra/ui";
import { createSupabaseServerClient } from "@lyra/platform/supabase/server";
import { requireBusiness } from "@lyra/platform/tenancy/context";

export const metadata: Metadata = { title: "Dashboard" };

function greeting(timezone: string, now = new Date()): string {
  const hour = Number(new Intl.DateTimeFormat("en-AU", { hour: "numeric", hourCycle: "h23", timeZone: timezone }).format(now));
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

/**
 * Phase 1 dashboard: business summary and set-up steps from real records.
 * Appointment KPIs and the day's grooming timeline arrive with scheduling.
 */
export default async function Dashboard({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { business } = await requireBusiness(slug);
  const db = await createSupabaseServerClient();
  const [{ count: locations }, { count: team }] = await Promise.all([
    db.from("locations").select("id", { count: "exact", head: true }).eq("business_id", business.id).is("archived_at", null),
    db.from("business_members").select("id", { count: "exact", head: true }).eq("business_id", business.id).eq("status", "active"),
  ]);
  const today = new Intl.DateTimeFormat("en-AU", { weekday: "long", day: "numeric", month: "long", timeZone: business.timezone }).format(new Date());
  const steps = [
    { done: !!business.abn, label: "Add your ABN and GST status", href: `/b/${slug}/settings#details` },
    { done: (locations ?? 0) > 0, label: "Set up your locations", href: `/b/${slug}/settings#locations` },
  ];
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <header>
        <p className="text-sm text-muted">{today}</p>
        <h1 className="font-display text-3xl font-bold text-navy">{greeting(business.timezone)}</h1>
      </header>
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <Building2 className="size-5 text-primary-text" aria-hidden />
          <p className="mt-3 text-sm text-muted">Business</p>
          <p className="font-display text-lg font-semibold">{business.name}</p>
        </Card>
        <Card>
          <MapPin className="size-5 text-primary-text" aria-hidden />
          <p className="mt-3 text-sm text-muted">Locations</p>
          <p className="font-display text-2xl font-semibold tabular">{locations ?? 0}</p>
        </Card>
        <Card>
          <Users className="size-5 text-primary-text" aria-hidden />
          <p className="mt-3 text-sm text-muted">Team members</p>
          <p className="font-display text-2xl font-semibold tabular">{team ?? 0}</p>
        </Card>
      </div>
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
    </div>
  );
}
