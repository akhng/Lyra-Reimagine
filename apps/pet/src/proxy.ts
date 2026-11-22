import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { clientEnv } from "@lyra/platform/env";
import { safeNextPath } from "@lyra/platform/auth/safe-redirect";
import { isAuthRoute, isProtectedRoute } from "@/lib/routes";

function contentSecurityPolicy(nonce: string, supabaseUrl: string): string {
  const dev = process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' blob: data: ${supabaseUrl}`,
    "font-src 'self'",
    `connect-src 'self' ${supabaseUrl} ${supabaseUrl.replace(/^http/, "ws")}${dev ? " ws:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

/** Every request: CSP nonce, Supabase session refresh, and redirects for protected and auth pages. */
export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const env = clientEnv();
  const csp = contentSecurityPolicy(nonce, env.NEXT_PUBLIC_SUPABASE_URL);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  let response = NextResponse.next({ request: { headers: requestHeaders } });
  const supabase = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(toSet) {
        for (const { name, value } of toSet) request.cookies.set(name, value);
        response = NextResponse.next({ request: { headers: requestHeaders } });
        for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
      },
    },
  });
  // Before any redirect decision, so expired sessions are refreshed.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;
  let redirectTo: URL | null = null;
  if (!user && isProtectedRoute(pathname)) {
    redirectTo = new URL("/login", request.url);
    redirectTo.searchParams.set("next", safeNextPath(pathname + search));
  } else if (user && isAuthRoute(pathname)) {
    redirectTo = new URL(safeNextPath(request.nextUrl.searchParams.get("next")), request.url);
  }
  if (redirectTo) {
    const redirect = NextResponse.redirect(redirectTo);
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  }
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)"] };
