import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonVariants, Card } from "@lyra/ui";
import { requireUser } from "@lyra/platform/auth/session";
import { PageHeader } from "@/components/PageHeader";
import { PetAvatar } from "@/components/PetAvatar";
import { OwnerPetForm } from "@/components/portal/OwnerPetForm";
import { OwnerPetPhoto } from "@/components/portal/OwnerPetPhoto";
import { myOwnerPets } from "@/features/portal/queries";
import { ageLabel } from "@/features/portal/schemas";

export const metadata: Metadata = { title: "Pet profile" };

export default async function PetProfile({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const [{ id }, sp, user] = await Promise.all([params, searchParams, requireUser()]);
  const pet = (await myOwnerPets()).find((p) => p.id === id);
  if (!pet) notFound();
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader title={pet.name} description={[pet.breed, ageLabel(pet.dateOfBirth, pet.estimatedAge)].filter(Boolean).join(" · ") || undefined} back={{ href: "/me", label: "My pets" }} actions={<Link href={`/me/book?pet=${pet.id}`} className={buttonVariants()}>Book a groom</Link>} />
      {sp.saved ? (
        <p role="status" className="rounded-full bg-mint-tint px-4 py-2 text-sm font-semibold text-success">
          Saved. Salons you book with will see the update.
        </p>
      ) : null}
      <Card className="flex flex-wrap items-center gap-5">
        <PetAvatar url={pet.photoUrl} species={pet.species} name={pet.name} size="lg" alt={pet.photoUrl ? `Photo of ${pet.name}` : ""} />
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted">A clear, recent photo helps your groomer recognise {pet.name}.</p>
          <OwnerPetPhoto userId={user.id} petId={pet.id} />
        </div>
      </Card>
      <Card>
        <OwnerPetForm pet={pet} />
      </Card>
    </div>
  );
}
