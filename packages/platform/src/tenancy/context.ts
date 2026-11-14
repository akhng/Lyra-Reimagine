import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { requireUser } from "../auth/session";
import { createSupabaseServerClient } from "../supabase/server";
import { isRole, type Role } from "./roles";

export type BusinessContext = {
  business: { id: string; name: string; slug: string; timezone: string; currency: string; gstRegistered: boolean; abn: string | null; plan: string; status: string };
  role: Role;
  userId: string;
};

/**
 * Resolves the business in the URL for the signed-in user. Row Level Security
 * only returns businesses the user is an active member of, so another
 * tenant's slug is indistinguishable from a missing one (404, no leak).
 */
export const requireBusiness = cache(async (slug: string): Promise<BusinessContext> => {
  const user = await requireUser();
  const db = await createSupabaseServerClient();
  const { data } = await db
    .from("businesses")
    .select("id, name, slug, timezone, currency, gst_registered, abn, plan, status, business_members!inner(role, status, user_id)")
    .eq("slug", slug)
    .eq("business_members.user_id", user.id)
    .eq("business_members.status", "active")
    .maybeSingle();
  const member = data?.business_members?.[0];
  if (!data || !member || !isRole(member.role) || data.status !== "active") notFound();
  return {
    business: { id: data.id, name: data.name, slug: data.slug, timezone: data.timezone, currency: data.currency, gstRegistered: data.gst_registered, abn: data.abn, plan: data.plan, status: data.status },
    role: member.role,
    userId: user.id,
  };
});

/** The businesses the signed-in user belongs to (for the switcher and landing). */
export const myBusinesses = cache(async (): Promise<Array<{ slug: string; name: string; role: Role }>> => {
  const user = await requireUser();
  const db = await createSupabaseServerClient();
  const { data, error } = await db.from("business_members").select("role, businesses!inner(slug, name, status)").eq("user_id", user.id).eq("status", "active").order("created_at");
  if (error) throw new Error("memberships query failed");
  return (data ?? []).flatMap((m) => (isRole(m.role) && m.businesses.status === "active" ? [{ slug: m.businesses.slug, name: m.businesses.name, role: m.role }] : []));
});
