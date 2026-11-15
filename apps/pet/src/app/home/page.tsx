import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card } from "@lyra/ui";
import { createSupabaseServerClient } from "@lyra/platform/supabase/server";
import { myBusinesses } from "@lyra/platform/tenancy/context";
import { Brand } from "@/components/Brand";
import { Mascot } from "@/components/mascots/Mascot";

export const metadata: Metadata = { title: "Welcome" };

/**
 * Landing after sign-in (ADR 0003: one account can be staff, a pet owner, or
 * both). Businesses come first; people without one go to their pet portal,
 * unless they signed up to run a business and haven't set it up yet.
 */
export default async function Home() {
  const businesses = await myBusinesses();
  if (businesses.length === 0) {
    const db = await createSupabaseServerClient();
    const { data } = await db.auth.getUser();
    redirect(data.user?.user_metadata?.intent === "business" ? "/onboarding" : "/me");
  }
  if (businesses.length === 1) redirect(`/b/${businesses[0]!.slug}`); // length checked
  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <Brand href="/home" />
      <h1 className="mt-8 font-display text-2xl font-bold">Choose a business</h1>
      <ul className="mt-4 flex flex-col gap-3">
        {businesses.map((b) => (
          <li key={b.slug}>
            <Link href={`/b/${b.slug}`} className="block">
              <Card className="lift">
                <p className="font-display font-semibold">{b.name}</p>
                <p className="text-sm text-muted capitalize">{b.role}</p>
              </Card>
            </Link>
          </li>
        ))}
        <li>
          <Link href="/me" className="block">
            <Card className="lift flex items-center gap-3 bg-mint-tint">
              <Mascot name="mochi" pose="peek" className="w-14" />
              <span>
                <span className="block font-display font-semibold">My pets</span>
                <span className="block text-sm text-muted">Your own pets and grooming bookings</span>
              </span>
            </Card>
          </Link>
        </li>
      </ul>
      <Link href="/onboarding" className="mt-6 inline-block text-sm font-medium text-primary-text hover:underline">
        Set up another business
      </Link>
    </div>
  );
}
