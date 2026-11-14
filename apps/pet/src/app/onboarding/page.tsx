import type { Metadata } from "next";
import { requireUser } from "@lyra/platform/auth/session";
import { Brand } from "@/components/Brand";
import { OnboardingForm } from "@/components/OnboardingForm";

export const metadata: Metadata = { title: "Set up your business" };

export default async function Onboarding() {
  await requireUser();
  return (
    <div className="min-h-dvh px-4 py-6">
      <header className="mx-auto max-w-xl">
        <Brand href="/home" />
      </header>
      <main id="main" className="mx-auto mt-8 max-w-xl">
        <OnboardingForm />
      </main>
    </div>
  );
}
