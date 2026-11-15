"use server";
import { createSupabaseServerClient } from "@lyra/platform/supabase/server";
import { requireBusiness } from "@lyra/platform/tenancy/context";
import { logger } from "@lyra/platform/logger";
import { layoutSchema, normaliseLayout } from "./layout";

/** Saves the signed-in person's dashboard layout for this business (their own row only; RLS checks membership). */
export async function saveDashboardLayoutAction(slug: string, raw: unknown): Promise<{ ok: boolean }> {
  const ctx = await requireBusiness(slug);
  const parsed = layoutSchema.safeParse(raw);
  if (!parsed.success) return { ok: false };
  const layout = normaliseLayout(parsed.data);
  const db = await createSupabaseServerClient();
  const { error } = await db.from("dashboard_layouts").upsert({ user_id: ctx.userId, business_id: ctx.business.id, layout, updated_at: new Date().toISOString() });
  if (error) {
    logger.warn({ businessId: ctx.business.id, code: error.code }, "dashboard layout save failed");
    return { ok: false };
  }
  return { ok: true };
}
