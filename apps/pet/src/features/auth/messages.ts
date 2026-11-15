/**
 * User-facing messages for Supabase Auth errors. Only a genuine wrong
 * email/password says so; configuration, network and rate-limit problems get
 * their own wording so they aren't mistaken for a typo.
 */
export type AuthErrorLike = { code?: string; status?: number; message: string };

export function signInMessage(e: AuthErrorLike): string {
  if (e.code === "email_not_confirmed" || /not confirmed/i.test(e.message)) return "Please confirm your email first — check your inbox for the link.";
  if (e.code === "invalid_credentials" || /invalid login credentials/i.test(e.message)) return "That email and password don't match.";
  if (e.status === 429 || e.code === "over_request_rate_limit") return "Too many attempts. Please wait a few minutes and try again.";
  return "We couldn't sign you in right now. Please try again shortly.";
}

export function signUpMessage(e: AuthErrorLike): string | null {
  // Same response whether or not the address is already registered (no account enumeration).
  if (e.code === "user_already_exists" || /already registered/i.test(e.message)) return null;
  if (e.code === "weak_password") return "Please choose a stronger password.";
  if (e.status === 429 || e.code === "over_email_send_rate_limit") return "We've sent too many emails in the last hour. Please try again later.";
  return "We couldn't create your account. Please try again.";
}
