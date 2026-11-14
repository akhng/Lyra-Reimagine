import "server-only";
import { createClient } from "@supabase/supabase-js";
import { serverEnv } from "../env";
import type { Database } from "../database";

/**
 * SERVICE-ROLE client — bypasses Row Level Security. Permitted only for:
 *   1. Scheduled jobs (reminders, notifications) acting for a specific tenant
 *   2. Platform administration after the server-side PLATFORM_ADMIN_EMAILS check, audited
 *   3. Tests that seed or inspect state across tenants
 * Every call site carries a comment and filters by a server-derived tenant id.
 * Never import from client code.
 */
export function createSupabaseAdminClient() {
  const env = serverEnv();
  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}
