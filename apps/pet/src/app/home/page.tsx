import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card } from "@lyra/ui";
import { myBusinesses } from "@lyra/platform/tenancy/context";
import { Brand } from "@/components/Brand";

export const metadata: Metadata = { title: "Your businesses" };

/** Landing after sign-in: no business → onboarding; one → straight in; several → choose. */
export default async function Home() {
  const businesses = await myBusinesses();
  if (businesses.length === 0) redirect("/onboarding");
  if (businesses.length === 1) redirect(`/b/${businesses[0]!.slug}`); // length checked
  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <Brand href="/home" />
      <h1 className="mt-8 font-display text-2xl font-bold">Choose a business</h1>
      <ul className="mt-4 flex flex-col gap-3">
        {businesses.map((b) => (
          <li key={b.slug}>
            <Link href={`/b/${b.slug}`} className="block">
              <Card className="transition-colors hover:border-primary">
                <p className="font-display font-semibold">{b.name}</p>
                <p className="text-sm text-muted capitalize">{b.role}</p>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
      <Link href="/onboarding" className="mt-6 inline-block text-sm font-medium text-primary-text hover:underline">
        Set up another business
      </Link>
    </div>
  );
}
