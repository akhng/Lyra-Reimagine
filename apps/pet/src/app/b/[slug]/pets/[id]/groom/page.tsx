import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireBusiness } from "@lyra/platform/tenancy/context";
import { GroomingRecordForm } from "@/components/grooming/GroomingRecordForm";
import { PageHeader } from "@/components/PageHeader";
import { getPet } from "@/features/pets/queries";
import { listServices } from "@/features/services/queries";
import { listTeam } from "@/features/team/queries";
import { localDate } from "@/lib/dates";
import { uuidOr404 } from "@/lib/params";

export const metadata: Metadata = { title: "Record a groom" };

export default async function RecordGroom({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id: rawId } = await params;
  const id = uuidOr404(rawId);
  const { business, userId } = await requireBusiness(slug);
  const [pet, team, services] = await Promise.all([getPet(business.id, id), listTeam(business.id), listServices(business.id, { activeOnly: true })]);
  if (!pet) notFound();
  const me = team.find((m) => m.userId === userId);
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <PageHeader title={`Record a groom for ${pet.name}`} back={{ href: `/b/${slug}/pets/${id}`, label: pet.name }} />
      <GroomingRecordForm slug={slug} businessId={business.id} petId={id} today={localDate(business.timezone)} groomers={team} defaultGroomerId={me?.id ?? null} services={services.map((s) => ({ id: s.id, name: s.name }))} />
    </div>
  );
}
