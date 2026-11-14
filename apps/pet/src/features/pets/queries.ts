import "server-only";
import { createSupabaseServerClient } from "@lyra/platform/supabase/server";
import { signPaths } from "../grooming/queries";

/** All pets in the business with their owner, optionally filtered by pet name or breed. */
export async function listPets(businessId: string, query: string) {
  const db = await createSupabaseServerClient();
  let q = db.from("pets").select("id, name, species, breed, size, photo_path, customer_id, customers!inner(first_name, last_name)").eq("business_id", businessId).is("archived_at", null);
  const term = query.replace(/[%_,()\\]/g, " ").trim().slice(0, 60);
  if (term) q = q.or(`name.ilike.%${term}%,breed.ilike.%${term}%`);
  const { data, error } = await q.order("name").limit(200);
  if (error) throw new Error("pets query failed");
  const rows = data ?? [];
  const urls = await signPaths(rows.flatMap((p) => (p.photo_path ? [p.photo_path] : [])));
  return rows.map((p) => ({ ...p, photoUrl: p.photo_path ? (urls.get(p.photo_path) ?? null) : null }));
}

export async function getPet(businessId: string, id: string) {
  const db = await createSupabaseServerClient();
  const { data } = await db.from("pets").select("*, customers!inner(id, first_name, last_name)").eq("business_id", businessId).eq("id", id).maybeSingle();
  if (!data) return null;
  const urls = await signPaths(data.photo_path ? [data.photo_path] : []);
  return { ...data, photoUrl: data.photo_path ? (urls.get(data.photo_path) ?? null) : null };
}
