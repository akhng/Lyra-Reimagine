import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireBusiness } from "@lyra/platform/tenancy/context";
import { GroomingRecordForm } from "@/components/grooming/GroomingRecordForm";
import { PageHeader } from "@/components/PageHeader";
import { getPet } from "@/features/pets/queries";
import { listServices } from "@/features/services/queries";
import { listTeam } from "@/features/team/queries";
import { localDate } from "@/lib/dates";
import { getAppointment } from "@/features/scheduling/queries";
import { toLocal } from "@/features/scheduling/time";
import { param, uuidOr404 } from "@/lib/params";

export const metadata: Metadata = { title: "Record a groom" };

export default async function RecordGroom({ params, searchParams }: { params: Promise<{ slug: string; id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { slug, id: rawId } = await params;
  const appointmentParam = param((await searchParams).appointment);
  const id = uuidOr404(rawId);
  const { business, userId } = await requireBusiness(slug);
  const [pet, team, services] = await Promise.all([getPet(business.id, id), listTeam(business.id), listServices(business.id, { activeOnly: true })]);
  if (!pet) notFound();
  const me = team.find((m) => m.userId === userId);
  // From an appointment: prefill its groomer, date and services (matched by name, as appointments keep a snapshot).
  const appt = /^[0-9a-f-]{36}$/.test(appointmentParam) ? await getAppointment(business.id, appointmentParam) : null;
  const fromAppt = appt && appt.petId === id ? appt : null;
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <PageHeader title={`Record a groom for ${pet.name}`} back={{ href: `/b/${slug}/pets/${id}`, label: pet.name }} />
      <GroomingRecordForm
        slug={slug}
        businessId={business.id}
        petId={id}
        today={localDate(business.timezone)}
        groomers={team}
        defaultGroomerId={fromAppt?.groomerId ?? me?.id ?? null}
        services={services.map((s) => ({ id: s.id, name: s.name }))}
        appointmentId={fromAppt?.id ?? null}
        preselectedServiceIds={fromAppt ? services.filter((s) => fromAppt.services.includes(s.name)).map((s) => s.id) : []}
        defaultDate={fromAppt ? toLocal(Date.parse(fromAppt.startsAt), business.timezone).date : undefined}
      />
    </div>
  );
}
