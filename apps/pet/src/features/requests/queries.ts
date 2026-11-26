import "server-only";
import { after } from "next/server";
import { processEmailOutbox } from "@/features/email/service";
import { processRefunds } from "@/features/payments/service";
import { createSupabaseServerClient } from "@lyra/platform/supabase/server";

/** The business's booking requests (RLS: members of this business only). */
export type BusinessRequest = {
  id: string; status: string; createdAt: string; preferredStart: string | null; windows: Array<{ date: string; part: "morning" | "afternoon" | "any" }>; notes: string | null;
  estimateCents: number | null; estimateFrom: boolean; minutes: number; services: string[]; customerName: string; customerId: string;
  pet: { id: string; name: string; species: string; breed: string | null; size: string | null; ownerNotes: string | null; photoUrl: string | null };
  appointmentId: string | null; decisionReason: string | null; acceptDeadline: string | null; assignedGroomerId: string | null; acceptedBy: string | null;
};

export async function requestsForBusiness(businessId: string, statuses?: string[]): Promise<BusinessRequest[]> {
  const db = await createSupabaseServerClient();
  // Move on requests whose time or acceptance deadline has passed before reading them.
  await db.rpc("tidy_booking_requests", { p_business: businessId });
  // Refund customers whose paid requests were declined, expired or cancelled (idempotent, retried here).
  await processRefunds(businessId).catch(() => 0);
  // Retry customer emails that didn't go out straight away, after the page is sent.
  after(() => processEmailOutbox());
  let q = db
    .from("booking_requests")
    .select("id, status, created_at, preferred_start, windows, notes, estimate_cents, estimate_from, estimate_minutes, appointment_id, decision_reason, accept_deadline, assigned_groomer_id, accepted_by, customer_id, customers!inner(first_name, last_name), pets!booking_requests_pet_id_business_id_fkey!inner(id, name, species, breed, size, owner_notes, photo_path, owner_pets(photo_path)), booking_request_services(name, position)")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (statuses?.length) q = q.in("status", statuses as never);
  const { data, error } = await q;
  if (error) throw new Error("requests query failed");
  type Row = {
    id: string; status: string; created_at: string; preferred_start: string | null; windows: BusinessRequest["windows"]; notes: string | null; estimate_cents: number | null; estimate_from: boolean; estimate_minutes: number;
    appointment_id: string | null; decision_reason: string | null; accept_deadline: string | null; assigned_groomer_id: string | null; accepted_by: string | null; customer_id: string; customers: { first_name: string; last_name: string | null };
    pets: { id: string; name: string; species: string; breed: string | null; size: string | null; owner_notes: string | null; photo_path: string | null; owner_pets: { photo_path: string | null } | null };
    booking_request_services: Array<{ name: string; position: number }>;
  };
  const rows = (data ?? []) as unknown as Row[];
  // Business photos live in "media"; owner photos in "owner-media" (staff may read them for linked pets).
  const ownerPaths = rows.flatMap((r) => (!r.pets.photo_path && r.pets.owner_pets?.photo_path ? [r.pets.owner_pets.photo_path] : []));
  const mediaPaths = rows.flatMap((r) => (r.pets.photo_path ? [r.pets.photo_path] : []));
  const [owner, media] = await Promise.all([
    ownerPaths.length ? db.storage.from("owner-media").createSignedUrls(ownerPaths, 3600) : Promise.resolve({ data: [] }),
    mediaPaths.length ? db.storage.from("media").createSignedUrls(mediaPaths, 3600) : Promise.resolve({ data: [] }),
  ]);
  const urls = new Map([...(owner.data ?? []), ...(media.data ?? [])].flatMap((s) => (s.path && s.signedUrl ? [[s.path, s.signedUrl] as const] : [])));
  return rows.map((r) => ({
    id: r.id, status: r.status, createdAt: r.created_at, preferredStart: r.preferred_start, windows: r.windows ?? [], notes: r.notes, estimateCents: r.estimate_cents, estimateFrom: r.estimate_from, minutes: r.estimate_minutes,
    services: [...r.booking_request_services].sort((a, b) => a.position - b.position).map((s) => s.name), customerName: `${r.customers.first_name} ${r.customers.last_name ?? ""}`.trim(), customerId: r.customer_id,
    pet: { id: r.pets.id, name: r.pets.name, species: r.pets.species, breed: r.pets.breed, size: r.pets.size, ownerNotes: r.pets.owner_notes, photoUrl: urls.get(r.pets.photo_path ?? r.pets.owner_pets?.photo_path ?? "") ?? null },
    appointmentId: r.appointment_id, decisionReason: r.decision_reason, acceptDeadline: r.accept_deadline, assignedGroomerId: r.assigned_groomer_id, acceptedBy: r.accepted_by,
  }));
}

export async function marketplaceProfile(businessId: string) {
  const db = await createSupabaseServerClient();
  const { data } = await db.from("marketplace_profiles").select("listed, accepting_requests, headline, about, suburb, mascot").eq("business_id", businessId).maybeSingle();
  return data;
}
