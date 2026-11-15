import type { Metadata } from "next";
import { PawPrint, Search } from "lucide-react";
import Link from "next/link";
import { EmptyState, Input, buttonVariants } from "@lyra/ui";
import { requireBusiness } from "@lyra/platform/tenancy/context";
import { PageHeader } from "@/components/PageHeader";
import { PetAvatar } from "@/components/PetAvatar";
import { listPets } from "@/features/pets/queries";
import { param } from "@/lib/params";
import { Mascot } from "@/components/mascots/Mascot";

export const metadata: Metadata = { title: "Pets" };

export default async function Pets({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { slug } = await params;
  const q = param((await searchParams).q).trim();
  const { business } = await requireBusiness(slug);
  const pets = await listPets(business.id, q);
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <PageHeader title="Pets" description="Every pet you groom. Add a pet from its owner's page." />
      <form role="search" className="flex gap-2" action={`/b/${slug}/pets`}>
        <label htmlFor="q" className="sr-only">Search pets</label>
        <Input id="q" name="q" type="search" defaultValue={q} placeholder="Pet name or breed" className="flex-1" />
        <button type="submit" className={buttonVariants({ variant: "secondary" })}><Search className="size-4" aria-hidden /> Search</button>
      </form>
      {pets.length === 0 ? (
        <EmptyState art={<Mascot name="mochi" mood="happy" className="w-28" />}
          icon={<PawPrint />}
          title={q ? "No matching pets" : "No pets yet"}
          description={q ? "Try another name or breed." : "Pets are added from their owner's profile."}
          action={q ? undefined : <Link href={`/b/${slug}/customers`} className={buttonVariants()}>Go to customers</Link>}
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {pets.map((p) => (
            <li key={p.id}>
              <Link href={`/b/${slug}/pets/${p.id}`} className="flex items-center gap-3 rounded-[var(--radius-card)] border border-border bg-surface p-4 shadow-[var(--shadow-card)] hover:border-primary">
                <PetAvatar url={p.photoUrl} species={p.species} />
                <span className="min-w-0">
                  <span className="block font-semibold">{p.name}</span>
                  <span className="block truncate text-sm text-muted">{p.breed ?? p.species} · {p.customers.first_name} {p.customers.last_name ?? ""}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
