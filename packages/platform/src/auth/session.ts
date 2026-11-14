import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "../supabase/server";

export type SessionUser = { id: string; email: string };

/** The signed-in user (verified with Supabase Auth), or null. Cached per request. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const db = await createSupabaseServerClient();
  const { data } = await db.auth.getUser();
  return data.user ? { id: data.user.id, email: data.user.email ?? "" } : null;
});

/** For pages and actions that need a user: redirects to sign-in when there is none. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}
