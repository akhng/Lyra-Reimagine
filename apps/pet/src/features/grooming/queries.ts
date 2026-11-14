import "server-only";
import { createSupabaseServerClient } from "@lyra/platform/supabase/server";

const SIGNED_URL_SECONDS = 60 * 60;

export type Photo = { id: string; kind: "before" | "after"; url: string | null };
export type GroomRecord = {
  id: string; groomed_on: string; groomer_id: string | null; services_summary: string | null; duration_minutes: number | null; haircut: string | null; shampoo: string | null;
  customer_instructions: string | null; observations: string | null; customer_feedback: string | null; photos: Photo[];
};

/** Short-lived signed URLs for private photos; RLS on storage means only members of the business can sign them. */
export async function signPaths(paths: string[]): Promise<Map<string, string>> {
  if (paths.length === 0) return new Map();
  const db = await createSupabaseServerClient();
  const { data } = await db.storage.from("media").createSignedUrls(paths, SIGNED_URL_SECONDS);
  return new Map((data ?? []).flatMap((s) => (s.path && s.signedUrl ? [[s.path, s.signedUrl] as const] : [])));
}

/** A pet's grooming history, newest first, with signed photo URLs. */
export async function petHistory(businessId: string, petId: string): Promise<GroomRecord[]> {
  const db = await createSupabaseServerClient();
  const { data, error } = await db
    .from("grooming_records")
    .select("id, groomed_on, groomer_id, services_summary, duration_minutes, haircut, shampoo, customer_instructions, observations, customer_feedback, grooming_photos(id, kind, storage_path, created_at)")
    .eq("business_id", businessId)
    .eq("pet_id", petId)
    .order("groomed_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error("grooming history failed");
  const rows = data ?? [];
  const urls = await signPaths(rows.flatMap((r) => r.grooming_photos.map((p) => p.storage_path)));
  return rows.map(({ grooming_photos, ...r }) => ({
    ...r,
    photos: [...grooming_photos].sort((a, b) => a.created_at.localeCompare(b.created_at)).map((p) => ({ id: p.id, kind: p.kind, url: urls.get(p.storage_path) ?? null })),
  }));
}

/** Recent grooms across the business (the "Grooming records" page). */
export async function recentGrooms(businessId: string, limit = 50) {
  const db = await createSupabaseServerClient();
  const { data, error } = await db
    .from("grooming_records")
    .select("id, groomed_on, groomer_id, services_summary, pet_id, pets!inner(name, breed, customer_id, customers!inner(first_name, last_name)), grooming_photos(id)")
    .eq("business_id", businessId)
    .order("groomed_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error("recent grooms failed");
  return data ?? [];
}
