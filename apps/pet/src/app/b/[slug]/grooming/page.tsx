import type { Metadata } from "next";
import { Camera, Scissors } from "lucide-react";
import Link from "next/link";
import { EmptyState, buttonVariants } from "@lyra/ui";
import { requireBusiness } from "@lyra/platform/tenancy/context";
import { PageHeader } from "@/components/PageHeader";
import { recentGrooms } from "@/features/grooming/queries";
import { listTeam } from "@/features/team/queries";
import { formatDay } from "@/lib/dates";

export const metadata: Metadata = { title: "Grooming records" };

export default async function GroomingRecords({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { business } = await requireBusiness(slug);
  const [rows, team] = await Promise.all([recentGrooms(business.id), listTeam(business.id)]);
  const groomer = (id: string | null) => team.find((m) => m.id === id)?.name;
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <PageHeader title="Grooming records" description="The latest 50 grooms. Record a groom from the pet's page." />
      {rows.length === 0 ? (
        <EmptyState icon={<Scissors />} title="No grooms recorded yet" description="Open a pet and choose “Record a groom” to save notes and before/after photos." action={<Link href={`/b/${slug}/pets`} className={buttonVariants()}>Go to pets</Link>} />
      ) : (
        <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/b/${slug}/pets/${r.pet_id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 p-4 hover:bg-surface-2">
                <span className="w-28 shrink-0 text-sm font-medium tabular">{formatDay(r.groomed_on)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{r.pets.name} <span className="font-normal text-muted">· {r.pets.customers.first_name} {r.pets.customers.last_name ?? ""}</span></span>
                  <span className="block truncate text-sm text-muted">{[r.services_summary, groomer(r.groomer_id)].filter(Boolean).join(" · ") || "No services recorded"}</span>
                </span>
                {r.grooming_photos.length ? <span className="inline-flex items-center gap-1 text-sm text-muted"><Camera className="size-4" aria-hidden /> {r.grooming_photos.length}<span className="sr-only"> photos</span></span> : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
