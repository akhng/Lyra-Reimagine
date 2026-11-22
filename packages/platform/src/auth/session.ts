import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "../supabase/server";

export type SessionUser = { id: string; email: string };

/**
 * The signed-in user, or null. Cached per request.
 *
 * getClaims() verifies the session JWT's signature locally against the
 * project's published signing keys (cached), so it costs no round trip to
 * Supabase Auth per page. With a legacy symmetric (HS256) secret it falls
 * back to asking the Auth server, so it is never less safe than getUser().
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const db = await createSupabaseServerClient();
  const { data } = await db.auth.getClaims();
  const claims = data?.claims;
  return claims?.sub ? { id: claims.sub, email: claims.email ?? "" } : null;
});

/** For pages and actions that need a user: redirects to sign-in when there is none. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}
