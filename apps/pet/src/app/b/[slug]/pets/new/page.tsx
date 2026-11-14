import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@lyra/platform/supabase/server";
import { requireBusiness } from "@lyra/platform/tenancy/context";
import { PageHeader } from "@/components/PageHeader";
import { PetForm } from "@/components/pets/PetForm";
import { param, uuidOr404 } from "@/lib/params";

export const metadata: Metadata = { title: "Add pet" };

export default async function NewPet({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { slug } = await params;
  const customerId = uuidOr404(param((await searchParams).customer));
  const { business } = await requireBusiness(slug);
  const db = await createSupabaseServerClient();
  const { data: owner } = await db.from("customers").select("id, first_name").eq("business_id", business.id).eq("id", customerId).maybeSingle();
  if (!owner) notFound();
  const back = `/b/${slug}/customers/${owner.id}`;
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <PageHeader title={`Add a pet for ${owner.first_name}`} back={{ href: back, label: owner.first_name }} />
      <PetForm slug={slug} petId={null} customerId={owner.id} cancelHref={back} />
    </div>
  );
}
