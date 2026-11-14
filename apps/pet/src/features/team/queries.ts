import "server-only";
import { createSupabaseServerClient } from "@lyra/platform/supabase/server";

export type TeamMember = { id: string; name: string; role: string; userId: string };

/** Active team members (for groomer pickers). Names fall back to the role when no display name is set. */
export async function listTeam(businessId: string): Promise<TeamMember[]> {
  const db = await createSupabaseServerClient();
  const { data, error } = await db.from("business_members").select("id, display_name, role, user_id").eq("business_id", businessId).eq("status", "active").order("created_at");
  if (error) throw new Error("team query failed");
  return (data ?? []).map((m) => ({ id: m.id, name: m.display_name ?? `${m.role[0]!.toUpperCase()}${m.role.slice(1)}`, role: m.role, userId: m.user_id })); // roles are non-empty enum values
}
