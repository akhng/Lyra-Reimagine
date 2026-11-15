import type { Metadata } from "next";
import { Card } from "@lyra/ui";
import { requireBusiness } from "@lyra/platform/tenancy/context";
import { can } from "@lyra/platform/tenancy/roles";
import { PageHeader } from "@/components/PageHeader";
import { AllocationForm } from "@/components/shifts/AllocationForm";
import { allocationSettings } from "@/features/shifts/queries";
import { listTeam } from "@/features/team/queries";
import { notFound } from "next/navigation";

export const metadata: Metadata = { title: "Request allocation" };

export default async function AllocationSettings({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { business, role } = await requireBusiness(slug);
  if (!can(role, "hours.manage")) notFound();
  const [settings, team] = await Promise.all([allocationSettings(business.id), listTeam(business.id)]);
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader title="Request allocation" description="Decide who handles booking requests, how long groomers have to accept, and who can do which services." back={{ href: `/b/${slug}/settings`, label: "Settings" }} />
      <Card>
        <AllocationForm slug={slug} settings={settings} groomers={team.filter((m) => m.role !== "receptionist").map((m) => ({ id: m.id, name: m.name }))} />
      </Card>
    </div>
  );
}
