import "server-only";
import { createSupabaseServerClient } from "@lyra/platform/supabase/server";
import type { DirectoryRow } from "./schemas";

/** The customer directory with pets, groom counts and due dates; contact matches respect RLS (groomers can't search by phone). */
export async function searchCustomers(businessId: string, query: string): Promise<DirectoryRow[]> {
  const db = await createSupabaseServerClient();
  const { data, error } = await db.rpc("customer_directory", { p_business: businessId, p_query: query.slice(0, 80) || undefined });
  if (error) throw new Error("customer directory failed");
  return (data ?? []) as DirectoryRow[];
}

export async function getCustomer(businessId: string, id: string, withContact: boolean) {
  const db = await createSupabaseServerClient();
  const [{ data: customer }, contact, { data: pets }] = await Promise.all([
    db.from("customers").select("id, first_name, last_name, preferred_contact, preferred_groomer_id, notes, is_vip, marketing_consent, marketing_consent_at, created_at").eq("business_id", businessId).eq("id", id).maybeSingle(),
    withContact ? db.from("customer_contacts").select("email, mobile, address_line, suburb, state, postcode").eq("business_id", businessId).eq("customer_id", id).maybeSingle() : Promise.resolve({ data: null }),
    db.from("pets").select("id, name, species, breed, size, photo_path, groom_interval_weeks").eq("business_id", businessId).eq("customer_id", id).is("archived_at", null).order("created_at"),
  ]);
  if (!customer) return null;
  return { customer, contact: contact.data, pets: pets ?? [] };
}
