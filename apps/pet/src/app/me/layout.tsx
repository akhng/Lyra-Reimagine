import { requireUser } from "@lyra/platform/auth/session";
import { myBusinesses } from "@lyra/platform/tenancy/context";
import { Bell } from "@/components/notifications/Bell";
import { CustomerShell } from "@/components/portal/CustomerShell";
import { unreadConversations } from "@/features/messages/queries";
import { unreadCount } from "@/features/notifications/queries";

/** The pet owner portal (ADR 0003). Any signed-in person can use it, staff included. */
export default async function MeLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  const [businesses, unread, unreadMessages] = await Promise.all([myBusinesses(), unreadCount("customer"), unreadConversations({ customer: true })]);
  return (
    <CustomerShell staff={businesses.length > 0} unreadMessages={unreadMessages} bell={<Bell href="/me/notifications" count={unread} />}>
      {children}
    </CustomerShell>
  );
}
