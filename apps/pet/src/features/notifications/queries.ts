import "server-only";
import { requireUser } from "@lyra/platform/auth/session";
import { createSupabaseServerClient } from "@lyra/platform/supabase/server";
import type { NotificationData } from "./templates";

/** The signed-in person's notifications (RLS: own rows only), for one audience and optionally one business. */
export type AppNotification = { id: number; kind: string; data: NotificationData; readAt: string | null; createdAt: string; audience: "customer" | "staff" };

export async function myNotifications(audience: "customer" | "staff", businessId?: string, limit = 50): Promise<AppNotification[]> {
  await requireUser();
  const db = await createSupabaseServerClient();
  let q = db.from("notifications").select("id, kind, data, read_at, created_at, audience").eq("audience", audience).order("created_at", { ascending: false }).limit(limit);
  if (businessId) q = q.eq("business_id", businessId);
  const { data } = await q;
  return (data ?? []).map((n) => ({ id: n.id, kind: n.kind, data: (n.data ?? {}) as NotificationData, readAt: n.read_at, createdAt: n.created_at, audience: n.audience as "customer" | "staff" }));
}

export async function unreadCount(audience: "customer" | "staff", businessId?: string): Promise<number> {
  const db = await createSupabaseServerClient();
  let q = db.from("notifications").select("id", { count: "exact", head: true }).eq("audience", audience).is("read_at", null);
  if (businessId) q = q.eq("business_id", businessId);
  const { count } = await q;
  return count ?? 0;
}
