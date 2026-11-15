import type { Metadata } from "next";
import { EmptyState } from "@lyra/ui";
import { createSupabaseServerClient } from "@lyra/platform/supabase/server";
import { requireBusiness } from "@lyra/platform/tenancy/context";
import { can } from "@lyra/platform/tenancy/roles";
import { PageHeader } from "@/components/PageHeader";
import { AppointmentForm, type FormCustomer } from "@/components/scheduling/AppointmentForm";
import { schedulingSetup } from "@/features/scheduling/queries";
import { localToday } from "@/features/scheduling/time";
import { listServices } from "@/features/services/queries";
import { listTeam } from "@/features/team/queries";
import { param } from "@/lib/params";
import { Mascot } from "@/components/mascots/Mascot";

export const metadata: Metadata = { title: "New appointment" };

export default async function NewAppointment({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const { business, role } = await requireBusiness(slug);
  const back = { href: `/b/${slug}/calendar`, label: "Calendar" };
  if (!can(role, "appointments.manage")) return <div className="mx-auto max-w-3xl"><PageHeader title="New appointment" back={back} /><EmptyState art={<Mascot name="coco" mood="curious" className="w-28" />} title="Ask reception to book" description="Only owners, managers and reception can book appointments." /></div>;
  const db = await createSupabaseServerClient();
  const [{ data: rows }, services, team, setup] = await Promise.all([
    db.from("customers").select("id, first_name, last_name, pets(id, name, size, breed, archived_at)").eq("business_id", business.id).is("archived_at", null).order("first_name").limit(1000),
    listServices(business.id, { activeOnly: true }),
    listTeam(business.id),
    schedulingSetup(business.id),
  ]);
  const customers: FormCustomer[] = (rows ?? []).map((c) => ({ id: c.id, name: `${c.first_name} ${c.last_name ?? ""}`.trim(), pets: c.pets.filter((p) => !p.archived_at).map((p) => ({ id: p.id, name: p.name, size: p.size, breed: p.breed })) }));
  const locations = setup.locations.filter((l) => !l.isMobile).length ? setup.locations.filter((l) => !l.isMobile) : setup.locations;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(param(sp.date)) ? param(sp.date) : localToday(business.timezone);
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <PageHeader title="New appointment" back={back} />
      <AppointmentForm
        slug={slug}
        customers={customers}
        services={services.map((s) => ({ id: s.id, name: s.name, durationMinutes: s.duration_minutes, bufferMinutes: s.buffer_minutes, basePriceCents: s.base_price_cents, priceFrom: s.price_from, rules: s.service_price_rules.map((r) => ({ kind: r.kind, matchValue: r.match_value, priceCents: r.price_cents })) }))}
        groomers={team.map((m) => ({ id: m.id, name: m.name }))}
        locations={locations.map((l) => ({ id: l.id, name: l.name }))}
        initial={{ customerId: param(sp.customer) || undefined, petId: param(sp.pet) || undefined, date, time: /^\d{2}:\d{2}$/.test(param(sp.time)) ? param(sp.time) : undefined, groomerId: param(sp.groomer) || undefined }}
      />
    </div>
  );
}
