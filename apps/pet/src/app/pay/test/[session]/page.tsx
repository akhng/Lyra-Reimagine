import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card } from "@lyra/ui";
import { serverEnv } from "@lyra/platform/env";
import { FakePayButton } from "@/components/payments/FakePayButton";

export const metadata: Metadata = { title: "Test payment" };

/** Stand-in for Stripe Checkout in automated tests only (PAYMENTS_PROVIDER=fake; never in production). */
export default async function FakeCheckoutPage({ params, searchParams }: { params: Promise<{ session: string }>; searchParams: Promise<{ next?: string }> }) {
  const [{ session }, sp] = await Promise.all([params, searchParams]);
  if (serverEnv().PAYMENTS_PROVIDER !== "fake" || process.env.VERCEL_ENV === "production" || !/^cs_test_[a-f0-9]+$/.test(session)) notFound();
  const next = sp.next?.startsWith(serverEnv().APP_URL) ? sp.next : "/me/bookings";
  return (
    <main className="mx-auto max-w-md p-6">
      <Card>
        <h1 className="font-display text-2xl font-bold text-ink">Test checkout</h1>
        <p className="mt-2 text-sm text-muted">This page stands in for Stripe in automated tests. No money moves.</p>
        <div className="mt-5">
          <FakePayButton session={session} next={next} />
        </div>
      </Card>
    </main>
  );
}
