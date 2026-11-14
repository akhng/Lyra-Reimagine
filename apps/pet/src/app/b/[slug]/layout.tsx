import { requireBusiness } from "@lyra/platform/tenancy/context";
import { BusinessShell } from "@/components/BusinessShell";

/** Every page under /b/<slug> runs inside the tenant: membership is checked server-side (404 for outsiders). */
export default async function BusinessLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { business, role } = await requireBusiness(slug);
  return (
    <BusinessShell slug={business.slug} businessName={business.name} role={role}>
      {children}
    </BusinessShell>
  );
}
