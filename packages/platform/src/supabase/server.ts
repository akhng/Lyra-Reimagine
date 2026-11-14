import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { clientEnv } from "../env";
import type { Database } from "../database";

/**
 * User-scoped Supabase client for Server Components, Server Actions and Route
 * Handlers: the anon key plus the user's session cookie, so Row Level
 * Security applies. This is the default client.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const env = clientEnv();
  return createServerClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(toSet) {
        try {
          for (const { name, value, options } of toSet) cookieStore.set(name, value, options);
        } catch {
          // Server Components can't set cookies; the proxy refreshes the session on every request.
        }
      },
    },
  });
}

export type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;
