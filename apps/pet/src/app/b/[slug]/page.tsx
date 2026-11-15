import type { Metadata } from "next";
import { CheckCircle2, Circle } from "lucide-react";
import Link from "next/link";
import { Card, CardDescription, CardTitle } from "@lyra/ui";
import { createSupabaseServerClient } from "@lyra/platform/supabase/server";
import { requireBusiness } from "@lyra/platform/tenancy/context";
import { Board, type TileView } from "@/components/dashboard/Board";
import { Greeting } from "@/components/dashboard/Greeting";
import { AchievementsTile, CustomersTile, GroomersTile, RequestsTile, RevenueTile, ServicesTile, TodayTile } from "@/components/dashboard/TileContents";
import { allowedTiles, type TileId } from "@/features/dashboard/layout";
import { getDashboard } from "@/features/dashboard/queries";

export const metadata: Metadata = { title: "Dashboard" };

/**
 * Business dashboard (ADR 0003): a greeting from today's mascot, then a
 * personal board of tiles counted from real records. Set-up steps stay
 * until the business is ready to take bookings.
 */
export default async function Dashboard({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireBusiness(slug);
  const { business, role } = ctx;
  const db = await createSupabaseServerClient();
  const [d, { count: locations }, { count: hoursSet }, { data: policy }] = await Promise.all([
    getDashboard(ctx),
    db.from("locations").select("id", { count: "exact", head: true }).eq("business_id", business.id).is("archived_at", null),
    db.from("staff_hours").select("id", { count: "exact", head: true }).eq("business_id", business.id),
    db.from("booking_policies").select("online_enabled").eq("business_id", business.id).maybeSingle(),
  ]);
  const tz = business.timezone;
  const all: Record<TileId, TileView> = {
    today: { title: "Today's appointments", href: `/b/${slug}/calendar`, action: "Open calendar", tint: "bg-primary-tint", node: <TodayTile d={d} slug={slug} tz={tz} /> },
    requests: { title: "Booking requests", href: `/b/${slug}/requests`, action: d.pendingRequests.length ? "Review requests" : "Open requests", tint: "bg-coral-tint", node: <RequestsTile d={d} slug={slug} tz={tz} /> },
    groomers: { title: "Available groomers", href: `/b/${slug}/settings/hours`, action: "Team hours", tint: "bg-sky-tint", node: <GroomersTile d={d} /> },
    customers: { title: "Customers & pets", href: `/b/${slug}/customers`, action: "Open customers", tint: "bg-mint-tint", node: <CustomersTile d={d} /> },
    services: { title: "Grooming services", href: `/b/${slug}/services`, action: "Services & prices", tint: "bg-butter-tint", node: <ServicesTile d={d} /> },
    revenue: { title: "Revenue & performance", href: `/b/${slug}/grooming`, action: "Grooming records", tint: "bg-lavender-tint", node: <RevenueTile d={d} /> },
    achievements: { title: "Achievements", href: `/b/${slug}/grooming`, action: "See your grooms", tint: "bg-surface", node: <AchievementsTile d={d} /> },
  };
  const tiles = Object.fromEntries(allowedTiles(role).map((t) => [t, all[t]]));
  const directoryCount = d.customers.total;
  const services = d.services.active;
  const steps = [
    { done: !!business.abn, label: "Add your ABN and GST status", href: `/b/${slug}/settings#details` },
    { done: (locations ?? 0) > 0, label: "Set up your locations", href: `/b/${slug}/settings#locations` },
    { done: services > 0, label: "Add your services and prices", href: `/b/${slug}/services` },
    { done: directoryCount > 0, label: "Add your first customer and pet", href: `/b/${slug}/customers/new` },
    { done: (hoursSet ?? 0) > 0, label: "Set your opening and team hours", href: `/b/${slug}/settings/hours` },
    { done: !!policy?.online_enabled, label: "Turn on online booking", href: `/b/${slug}/settings/hours` },
  ];
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <Greeting businessName={business.name} tz={tz} visitsToday={d.today.length} toConfirm={d.awaitingConfirmation.length + d.pendingRequests.length} />
      {(role !== "owner" && role !== "manager") || steps.every((x) => x.done) ? null : (
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
      <Board slug={slug} initial={d.layout} tiles={tiles} />
    </div>
  );
}
