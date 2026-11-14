import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../packages/platform/src/database";

export const OLIVIA = { id: "aaaaaaaa-0000-4000-8000-000000000001", email: "olivia@example.test", password: "password-123" };
export const NED = { id: "bbbbbbbb-0000-4000-8000-000000000002", email: "ned@example.test", password: "password-123" };
export const PAWS = "a0000000-0000-4000-8000-000000000001";
export const NEAT = "b0000000-0000-4000-8000-000000000002";

const url = () => process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const adminClient = () => createClient<Database>(url(), process.env.SUPABASE_SERVICE_ROLE_KEY ?? "", { auth: { persistSession: false } });
export const anonClient = () => createClient<Database>(url(), process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "", { auth: { persistSession: false } });

export async function signedIn(user: { email: string; password: string }): Promise<SupabaseClient<Database>> {
  const db = anonClient();
  const { error } = await db.auth.signInWithPassword(user);
  if (error) throw new Error(`sign-in failed for ${user.email}: ${error.message}`);
  return db;
}

/** A fresh, confirmed user (deleted by the caller). */
export async function newUser(prefix: string) {
  const email = `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e5)}@example.test`;
  const password = "a-strong-passphrase-42";
  const { data, error } = await adminClient().auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: "Test Person" } });
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`);
  return { id: data.user.id, email, password };
}
