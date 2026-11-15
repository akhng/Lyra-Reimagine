import type { Metadata } from "next";
import { Clock, Globe, Tags } from "lucide-react";
import Link from "next/link";
import { Badge, Card, CardDescription, CardTitle, EmptyState } from "@lyra/ui";
import { requireBusiness } from "@lyra/platform/tenancy/context";
import { can } from "@lyra/platform/tenancy/roles";
import { PageHeader } from "@/components/PageHeader";
import { ServiceForm } from "@/components/services/ServiceForm";
import { formatAud } from "@/features/services/pricing";
import { listServices } from "@/features/services/queries";
import { Mascot } from "@/components/mascots/Mascot";

export const metadata: Metadata = { title: "Services & pricing" };

export default async function Services({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { business, role } = await requireBusiness(slug);
  const services = await listServices(business.id);
  const canEdit = can(role, "business.edit");
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <PageHeader title="Services & pricing" description="Prices include GST. Size and breed prices replace the base price; coat surcharges are added on top." />
      {services.length === 0 ? (
        <EmptyState art={<Mascot name="biscuit" mood="curious" className="w-28" />} icon={<Tags />} title="No services yet" description={canEdit ? "Add your first service below — for example a full groom, a bath and tidy, or nail clipping." : "An owner or manager can add services."} />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {services.map((s) => {
            const sizes = s.service_price_rules.filter((r) => r.kind === "size");
            const prices = [s.base_price_cents, ...sizes.map((r) => r.price_cents)];
            const range = sizes.length ? `${formatAud(Math.min(...prices))} – ${formatAud(Math.max(...prices))}` : `${s.price_from ? "From " : ""}${formatAud(s.base_price_cents)}`;
            const body = (
              <>
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{s.name}</span>
                  {!s.active ? <Badge>Inactive</Badge> : null}
                  {s.category ? <Badge tone="primary">{s.category}</Badge> : null}
                </span>
                <span className="mt-1 block font-display text-lg font-semibold tabular">{range}</span>
                <span className="mt-1 flex flex-wrap gap-3 text-sm text-muted">
                  <span className="inline-flex items-center gap-1"><Clock className="size-4" aria-hidden /> {s.duration_minutes} min</span>
                  {s.bookable_online ? <span className="inline-flex items-center gap-1"><Globe className="size-4" aria-hidden /> Online booking</span> : null}
                  {s.service_price_rules.length ? <span>{s.service_price_rules.length} price rule{s.service_price_rules.length === 1 ? "" : "s"}</span> : null}
                </span>
              </>
            );
            const cls = "block h-full rounded-[var(--radius-card)] border border-border bg-surface p-4 shadow-[var(--shadow-card)]";
            return (
              <li key={s.id}>
                {canEdit ? <Link href={`/b/${slug}/services/${s.id}`} className={`${cls} hover:border-primary`}>{body}</Link> : <div className={cls}>{body}</div>}
              </li>
            );
          })}
        </ul>
      )}
      {canEdit ? (
        <Card aria-labelledby="new-service-title">
          <CardTitle id="new-service-title">Add a service</CardTitle>
          <CardDescription>Online booking settings take effect when the booking portal launches.</CardDescription>
          <div className="mt-4">
            <ServiceForm slug={slug} idPrefix="new" />
          </div>
        </Card>
      ) : null}
    </div>
  );
}
