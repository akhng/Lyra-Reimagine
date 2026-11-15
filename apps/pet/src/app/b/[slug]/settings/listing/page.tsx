import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@lyra/ui";
import { requireBusiness } from "@lyra/platform/tenancy/context";
import { can } from "@lyra/platform/tenancy/roles";
import { PageHeader } from "@/components/PageHeader";
import { ListingForm } from "@/components/requests/ListingForm";
import { marketplaceProfile } from "@/features/requests/queries";

export const metadata: Metadata = { title: "Lyra Pet listing" };

export default async function ListingSettings({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { business, role } = await requireBusiness(slug);
  const listing = await marketplaceProfile(business.id);
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader title="Lyra Pet listing" description="Let pet owners find your salon and send booking requests you confirm." back={{ href: `/b/${slug}/settings`, label: "Settings" }} />
      <Card>
        <ListingForm slug={slug} listing={listing} canEdit={can(role, "business.edit")} />
      </Card>
      <p className="text-sm text-muted">
        Customers see services marked &ldquo;bookable online&rdquo; in{" "}
        <Link href={`/b/${slug}/services`} className="font-semibold text-primary-text hover:underline">
          Services &amp; pricing
        </Link>
        , your opening hours and your cancellation policy. Requests arrive under Requests for your front desk to confirm.
      </p>
    </div>
  );
}
