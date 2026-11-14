/** Pages that need a signed-in user. Everything else (landing, auth, public booking) is open. */
export function isProtectedRoute(pathname: string): boolean {
  return pathname === "/home" || pathname === "/onboarding" || pathname.startsWith("/onboarding/") || pathname.startsWith("/b/");
}

/** Auth pages a signed-in user should skip. */
export function isAuthRoute(pathname: string): boolean {
  return pathname === "/login" || pathname === "/signup";
}
