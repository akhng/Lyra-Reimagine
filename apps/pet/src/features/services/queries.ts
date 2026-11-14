import "server-only";
import { createSupabaseServerClient } from "@lyra/platform/supabase/server";

export type ServiceWithRules = {
  id: string; name: string; description: string | null; category: string | null; duration_minutes: number; buffer_minutes: number;
  base_price_cents: number; price_from: boolean; bookable_online: boolean; active: boolean;
  service_price_rules: Array<{ kind: "size" | "breed" | "coat_condition"; match_value: string; price_cents: number }>;
};

export async function listServices(businessId: string, opts: { activeOnly?: boolean } = {}): Promise<ServiceWithRules[]> {
  const db = await createSupabaseServerClient();
  let q = db.from("services").select("id, name, description, category, duration_minutes, buffer_minutes, base_price_cents, price_from, bookable_online, active, service_price_rules(kind, match_value, price_cents)").eq("business_id", businessId);
  if (opts.activeOnly) q = q.eq("active", true);
  const { data, error } = await q.order("active", { ascending: false }).order("position").order("name");
  if (error) throw new Error("services query failed");
  return (data ?? []) as ServiceWithRules[];
}
