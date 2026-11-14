import type { Metadata } from "next";
import { safeNextPath } from "@lyra/platform/auth/safe-redirect";
import { SignInForm } from "@/components/AuthForms";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  return <SignInForm next={safeNextPath(sp.next)} linkError={sp.error === "link"} />;
}
