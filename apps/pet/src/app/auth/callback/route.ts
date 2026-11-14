import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@lyra/platform/auth/safe-redirect";
import { createSupabaseServerClient } from "@lyra/platform/supabase/server";

/** Email confirmation and magic links land here: exchange the code for a session, then continue. */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));
  if (code) {
    const db = await createSupabaseServerClient();
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  }
  return NextResponse.redirect(new URL("/login?error=link", request.url));
}
