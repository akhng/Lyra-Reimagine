import { requireUser } from "@lyra/platform/auth/session";
import { myBusinesses } from "@lyra/platform/tenancy/context";
import { CustomerShell } from "@/components/portal/CustomerShell";

/** The pet owner portal (ADR 0003). Any signed-in person can use it, staff included. */
export default async function MeLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  const businesses = await myBusinesses();
  return <CustomerShell staff={businesses.length > 0}>{children}</CustomerShell>;
}
