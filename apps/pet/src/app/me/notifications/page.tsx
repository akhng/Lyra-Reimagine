import type { Metadata } from "next";
import { NotificationList } from "@/components/notifications/NotificationList";
import { PageHeader } from "@/components/PageHeader";
import { myNotifications } from "@/features/notifications/queries";
import { nowMs } from "@/features/scheduling/time";

export const metadata: Metadata = { title: "Notifications" };

export default async function MyNotifications() {
  const items = await myNotifications("customer");
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader title="Notifications" description="Updates about your requests and appointments." back={{ href: "/me", label: "Home" }} />
      <NotificationList items={items} audience="customer" path="/me" now={nowMs()} />
    </div>
  );
}
