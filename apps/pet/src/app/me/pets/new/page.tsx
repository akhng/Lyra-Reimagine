import type { Metadata } from "next";
import { Card } from "@lyra/ui";
import { PageHeader } from "@/components/PageHeader";
import { OwnerPetForm } from "@/components/portal/OwnerPetForm";

export const metadata: Metadata = { title: "Add a pet" };

export default function NewPet() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader title="Add a pet" description="You can add a photo once your pet is saved." back={{ href: "/me", label: "My pets" }} />
      <Card>
        <OwnerPetForm />
      </Card>
    </div>
  );
}
