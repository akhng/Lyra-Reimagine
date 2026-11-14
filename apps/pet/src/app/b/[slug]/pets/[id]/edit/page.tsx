import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireBusiness } from "@lyra/platform/tenancy/context";
import { PageHeader } from "@/components/PageHeader";
import { PetForm, type PetValues } from "@/components/pets/PetForm";
import { getPet } from "@/features/pets/queries";
import { PET_COLUMNS } from "@/features/pets/schemas";
import { uuidOr404 } from "@/lib/params";

export const metadata: Metadata = { title: "Edit pet" };

export default async function EditPet({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id: rawId } = await params;
  const id = uuidOr404(rawId);
  const { business } = await requireBusiness(slug);
  const pet = await getPet(business.id, id);
  if (!pet) notFound();
  const row = pet as unknown as Record<string, string | number | null>;
  const values: PetValues = Object.fromEntries(Object.entries(PET_COLUMNS).map(([field, column]) => [field, row[column] ?? null]));
  const back = `/b/${slug}/pets/${id}`;
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <PageHeader title={`Edit ${pet.name}`} back={{ href: back, label: pet.name }} />
      <PetForm slug={slug} petId={id} customerId={null} values={values} cancelHref={back} />
    </div>
  );
}
