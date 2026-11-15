"use client";
import Link from "next/link";
import { useActionState } from "react";
import { Button, Card, FormField, Input } from "@lyra/ui";
import { signInAction, signUpAction, type AuthState } from "@/features/auth/actions";

function FormError({ state }: { state: AuthState }) {
  return state?.error ? (
    <p role="alert" className="rounded-[var(--radius-control)] bg-danger-tint px-3 py-2 text-sm text-danger">
      {state.error}
    </p>
  ) : null;
}

export function SignUpForm() {
  const [state, action, pending] = useActionState(signUpAction, undefined);
  return (
    <Card className="p-8">
      <h1 className="font-display text-2xl font-bold">Create your account</h1>
      <p className="mt-1 text-sm text-muted">For pet owners booking grooms, and for grooming businesses.</p>
      <form action={action} className="mt-6 flex flex-col gap-4" noValidate>
        <FormError state={state} />
        <fieldset className="grid grid-cols-2 gap-2">
          <legend className="mb-1.5 text-sm font-medium text-text">I am…</legend>
          {[
            { value: "owner", title: "A pet owner", body: "Book grooms and keep pet profiles" },
            { value: "business", title: "A grooming business", body: "Run bookings, team and customers" },
          ].map((o, i) => (
            <label key={o.value} className="flex cursor-pointer flex-col gap-0.5 rounded-[var(--radius-control)] border-2 border-border bg-surface p-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary-tint has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary/40">
              <input type="radio" name="intent" value={o.value} defaultChecked={i === 0} className="sr-only" />
              <span className="font-bold text-ink">{o.title}</span>
              <span className="text-xs text-muted">{o.body}</span>
            </label>
          ))}
        </fieldset>
        <FormField id="fullName" label="Your name" error={state?.fields?.fullName}>
          {(p) => <Input {...p} name="fullName" autoComplete="name" required />}
        </FormField>
        <FormField id="email" label="Email" error={state?.fields?.email}>
          {(p) => <Input {...p} name="email" type="email" autoComplete="email" required />}
        </FormField>
        <FormField id="password" label="Password" hint="At least 10 characters." error={state?.fields?.password}>
          {(p) => <Input {...p} name="password" type="password" autoComplete="new-password" required />}
        </FormField>
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Creating account…" : "Create account"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary-text hover:underline">
          Sign in
        </Link>
      </p>
    </Card>
  );
}

export function SignInForm({ next, linkError }: { next: string; linkError: boolean }) {
  const [state, action, pending] = useActionState(signInAction, linkError ? { error: "That link has expired or was already used. Sign in, or request a new link." } : undefined);
  return (
    <Card className="p-8">
      <h1 className="font-display text-2xl font-bold">Welcome back</h1>
      <p className="mt-1 text-sm text-muted">Sign in to your grooming business.</p>
      <form action={action} className="mt-6 flex flex-col gap-4" noValidate>
        <FormError state={state} />
        <input type="hidden" name="next" value={next} />
        <FormField id="email" label="Email" error={state?.fields?.email}>
          {(p) => <Input {...p} name="email" type="email" autoComplete="email" required />}
        </FormField>
        <FormField id="password" label="Password" error={state?.fields?.password}>
          {(p) => <Input {...p} name="password" type="password" autoComplete="current-password" required />}
        </FormField>
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        New to Lyra Pet?{" "}
        <Link href="/signup" className="font-medium text-primary-text hover:underline">
          Create an account
        </Link>
      </p>
    </Card>
  );
}
