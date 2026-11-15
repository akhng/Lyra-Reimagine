"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@lyra/platform/auth/session";
import { createSupabaseServerClient } from "@lyra/platform/supabase/server";

/** Mark notifications read (RLS limits this to the person's own rows; only read_at is writable). */
export async function markNotificationsReadAction(ids: number[] | "all", audience: "customer" | "staff", path: string): Promise<{ ok: boolean }> {
  await requireUser();
  const db = await createSupabaseServerClient();
  let q = db.from("notifications").update({ read_at: new Date().toISOString() }).eq("audience", z.enum(["customer", "staff"]).parse(audience)).is("read_at", null);
  if (ids !== "all") q = q.in("id", z.array(z.number().int().positive()).max(200).parse(ids));
  const { error } = await q;
  if (path.startsWith("/")) revalidatePath(path, "layout");
  return { ok: !error };
}
