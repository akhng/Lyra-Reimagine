import type { Metadata } from "next";
import { EmptyState } from "@lyra/ui";
import { requireBusiness } from "@lyra/platform/tenancy/context";
import { can } from "@lyra/platform/tenancy/roles";
import { CustomerForm } from "@/components/customers/CustomerForm";
import { PageHeader } from "@/components/PageHeader";
import { listTeam } from "@/features/team/queries";
import { Mascot } from "@/components/mascots/Mascot";

export const metadata: Metadata = { title: "Add customer" };

export default async function NewCustomer({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { business, role } = await requireBusiness(slug);
  const back = { href: `/b/${slug}/customers`, label: "Customers" };
  if (!can(role, "customers.contact"))
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-5">
        <PageHeader title="Add customer" back={back} />
        <EmptyState art={<Mascot name="coco" mood="curious" className="w-28" />} title="Ask reception to add customers" description="Only owners, managers and reception can add customers, because it involves contact details." />
      </div>
    );
  const team = await listTeam(business.id);
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <PageHeader title="Add customer" description="You can add their pets next." back={back} />
      <CustomerForm slug={slug} groomers={team} />
    </div>
  );
}
