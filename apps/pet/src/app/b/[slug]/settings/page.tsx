import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, CardDescription, CardTitle, buttonVariants } from "@lyra/ui";
import { createSupabaseServerClient } from "@lyra/platform/supabase/server";
import { requireBusiness } from "@lyra/platform/tenancy/context";
import { can } from "@lyra/platform/tenancy/roles";
import { BusinessDetailsForm, LocationForm } from "@/components/SettingsForms";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { business, role } = await requireBusiness(slug);
  const db = await createSupabaseServerClient();
  const [{ data: locations }, { data: team }] = await Promise.all([
    db.from("locations").select("id, name, address_line, suburb, state, postcode, is_mobile").eq("business_id", business.id).is("archived_at", null).order("created_at"),
    db.from("business_members").select("id, display_name, role, status").eq("business_id", business.id).order("created_at"),
  ]);
  const { data: details } = await db.from("businesses").select("phone, email").eq("id", business.id).single();
  const canLocations = can(role, "locations.manage");
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <h1 className="font-display text-3xl font-bold text-ink">Settings</h1>

      <Card id="details" aria-labelledby="details-title">
        <CardTitle id="details-title">Business details</CardTitle>
        <CardDescription>Used on receipts, tax invoices and your booking page.</CardDescription>
        <div className="mt-5">
          <BusinessDetailsForm slug={slug} canEdit={can(role, "business.edit")} business={{ name: business.name, timezone: business.timezone, abn: business.abn, gstRegistered: business.gstRegistered, phone: details?.phone ?? null, email: details?.email ?? null }} />
        </div>
      </Card>

      <Card aria-labelledby="hours-title">
        <CardTitle id="hours-title">Hours &amp; online booking</CardTitle>
        <CardDescription>Opening hours, team hours, time off, closures and your public booking page.</CardDescription>
        <Link href={`/b/${slug}/settings/hours`} className={`${buttonVariants({ variant: "secondary" })} mt-4`}>Manage hours &amp; online booking</Link>
      </Card>
      <Card id="locations" aria-labelledby="locations-title">
        <CardTitle id="locations-title">Locations</CardTitle>
        <CardDescription>Salons, shopfronts or a mobile van. Calendars and reports can be split by location.</CardDescription>
        <ul className="mt-5 flex flex-col gap-6">
          {(locations ?? []).map((l, i) => (
            <li key={l.id} className="border-b border-border pb-6 last:border-0 last:pb-0">
              {canLocations ? (
                <LocationForm slug={slug} idPrefix={`loc${i}`} location={{ id: l.id, name: l.name, addressLine: l.address_line, suburb: l.suburb, state: l.state, postcode: l.postcode, isMobile: l.is_mobile }} />
              ) : (
                <p className="text-sm">
                  <span className="font-medium">{l.name}</span> {[l.suburb, l.state].filter(Boolean).join(", ")}
                </p>
              )}
            </li>
          ))}
        </ul>
        {canLocations ? (
          <details className="mt-6 rounded-[var(--radius-control)] border border-dashed border-border p-4">
            <summary className="cursor-pointer text-sm font-medium text-primary-text">Add a location</summary>
            <div className="mt-4">
              <LocationForm slug={slug} idPrefix="new" />
            </div>
          </details>
        ) : null}
      </Card>

      <Card aria-labelledby="team-title">
        <CardTitle id="team-title">Team</CardTitle>
        <CardDescription>People who can sign in to this business and what they can do.</CardDescription>
        <ul className="mt-4 divide-y divide-border">
          {(team ?? []).map((m) => (
            <li key={m.id} className="flex items-center justify-between py-3 text-sm">
              <span className="font-medium">{m.display_name ?? "Team member"}</span>
              <span className="flex items-center gap-2">
                {m.status !== "active" ? <Badge tone="warning">{m.status}</Badge> : null}
                <Badge tone={m.role === "owner" ? "primary" : "neutral"} className="capitalize">
                  {m.role}
                </Badge>
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
