import { requireBusiness } from "@lyra/platform/tenancy/context";
import { BusinessShell } from "@/components/BusinessShell";
import { Bell } from "@/components/notifications/Bell";
import { unreadCount } from "@/features/notifications/queries";

/** Every page under /b/<slug> runs inside the tenant: membership is checked server-side (404 for outsiders). */
export default async function BusinessLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { business, role } = await requireBusiness(slug);
  const unread = await unreadCount("staff", business.id);
  return (
    <BusinessShell slug={business.slug} businessName={business.name} role={role} bell={<Bell href={`/b/${business.slug}/notifications`} count={unread} inverted />}>
      {children}
    </BusinessShell>
  );
}
