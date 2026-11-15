import type { Metadata } from "next";
import { requireBusiness } from "@lyra/platform/tenancy/context";
import { NotificationList } from "@/components/notifications/NotificationList";
import { PageHeader } from "@/components/PageHeader";
import { myNotifications } from "@/features/notifications/queries";
import { nowMs } from "@/features/scheduling/time";

export const metadata: Metadata = { title: "Notifications" };

export default async function StaffNotifications({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { business } = await requireBusiness(slug);
  const items = await myNotifications("staff", business.id);
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader title="Notifications" description="Requests, accepted shifts and cancellations for this business." />
      <NotificationList items={items} audience="staff" slug={slug} path={`/b/${slug}`} now={nowMs()} />
    </div>
  );
}
