"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { serverEnv } from "@lyra/platform/env";
import { safeNextPath } from "@lyra/platform/auth/safe-redirect";
import { createSupabaseServerClient } from "@lyra/platform/supabase/server";

export type AuthState = { error?: string; fields?: Record<string, string> } | undefined;

const signUpSchema = z.object({
  fullName: z.string().trim().min(1, "Enter your name").max(120),
  email: z.email("Enter a valid email address").max(254),
  password: z.string().min(10, "Use at least 10 characters").max(128),
});

export async function signUpAction(_prev: AuthState, form: FormData): Promise<AuthState> {
  const parsed = signUpSchema.safeParse({ fullName: form.get("fullName"), email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { fields: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])) };
  const db = await createSupabaseServerClient();
  const { error } = await db.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { full_name: parsed.data.fullName }, emailRedirectTo: `${serverEnv().APP_URL}/auth/callback?next=/home` },
  });
  // Same response whether or not the address is already registered (no account enumeration).
  if (error && !/already registered/i.test(error.message)) return { error: "We couldn't create your account. Please try again." };
  redirect(`/verify-email?email=${encodeURIComponent(parsed.data.email)}`);
}

const signInSchema = z.object({ email: z.email("Enter a valid email address"), password: z.string().min(1, "Enter your password") });

export async function signInAction(_prev: AuthState, form: FormData): Promise<AuthState> {
  const parsed = signInSchema.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { fields: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])) };
  const db = await createSupabaseServerClient();
  const { error } = await db.auth.signInWithPassword(parsed.data);
  if (error) return { error: /confirm/i.test(error.message) ? "Please confirm your email first — check your inbox for the link." : "That email and password don't match." };
  redirect(safeNextPath(String(form.get("next") ?? "")));
}

export async function signOutAction() {
  const db = await createSupabaseServerClient();
  await db.auth.signOut();
  redirect("/login");
}
