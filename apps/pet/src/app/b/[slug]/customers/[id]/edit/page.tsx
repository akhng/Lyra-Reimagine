import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireBusiness } from "@lyra/platform/tenancy/context";
import { can } from "@lyra/platform/tenancy/roles";
import { CustomerForm } from "@/components/customers/CustomerForm";
import { PageHeader } from "@/components/PageHeader";
import { getCustomer } from "@/features/customers/queries";
import { listTeam } from "@/features/team/queries";
import { uuidOr404 } from "@/lib/params";

export const metadata: Metadata = { title: "Edit customer" };

export default async function EditCustomer({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id: rawId } = await params;
  const id = uuidOr404(rawId);
  const { business, role } = await requireBusiness(slug);
  if (!can(role, "customers.contact")) notFound();
  const [data, team] = await Promise.all([getCustomer(business.id, id, true), listTeam(business.id)]);
  if (!data) notFound();
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <PageHeader title={`Edit ${data.customer.first_name}`} back={{ href: `/b/${slug}/customers/${id}`, label: "Back to customer" }} />
      <CustomerForm slug={slug} customer={data.customer} contact={data.contact} groomers={team} />
    </div>
  );
}
