import type { Metadata } from "next";
import { Card, CardDescription, CardTitle } from "@lyra/ui";
import { requireBusiness } from "@lyra/platform/tenancy/context";
import { can } from "@lyra/platform/tenancy/roles";
import { LoyaltyForm } from "@/components/loyalty/LoyaltyForm";
import { RewardsManager } from "@/components/loyalty/RewardsManager";
import { PageHeader } from "@/components/PageHeader";
import { loyaltySettings, rewards } from "@/features/loyalty/queries";

export const metadata: Metadata = { title: "Loyalty & rewards" };

export default async function LoyaltySettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { business, role } = await requireBusiness(slug);
  const [settings, list] = await Promise.all([loyaltySettings(business.id), rewards(business.id)]);
  const canEdit = can(role, "business.edit");
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader title="Loyalty & rewards" description="Reward the customers who keep coming back. Points never change your prices or availability." back={{ href: `/b/${slug}/settings`, label: "Settings" }} />
      <Card>
        <CardTitle>Point rules</CardTitle>
        <div className="mt-4">
          <LoyaltyForm slug={slug} settings={settings} canEdit={canEdit} />
        </div>
      </Card>
      <Card>
        <CardTitle>Rewards</CardTitle>
        <CardDescription>Customers see these in their app. Your front desk redeems them from the customer&apos;s page.</CardDescription>
        <div className="mt-4">
          <RewardsManager slug={slug} rewards={list} canEdit={canEdit} />
        </div>
      </Card>
    </div>
  );
}
