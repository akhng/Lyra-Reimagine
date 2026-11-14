import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card } from "@lyra/ui";
import { requireBusiness } from "@lyra/platform/tenancy/context";
import { can } from "@lyra/platform/tenancy/roles";
import { PageHeader } from "@/components/PageHeader";
import { ServiceForm } from "@/components/services/ServiceForm";
import { listServices } from "@/features/services/queries";
import { uuidOr404 } from "@/lib/params";

export const metadata: Metadata = { title: "Edit service" };

export default async function EditService({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id: rawId } = await params;
  const id = uuidOr404(rawId);
  const { business, role } = await requireBusiness(slug);
  if (!can(role, "business.edit")) notFound();
  const service = (await listServices(business.id)).find((s) => s.id === id);
  if (!service) notFound();
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <PageHeader title={`Edit ${service.name}`} back={{ href: `/b/${slug}/services`, label: "Services & pricing" }} />
      <Card>
        <ServiceForm slug={slug} service={service} idPrefix="edit" />
      </Card>
    </div>
  );
}
