import type { Metadata } from "next";
import { MailCheck } from "lucide-react";
import Link from "next/link";
import { Card } from "@lyra/ui";

export const metadata: Metadata = { title: "Check your email" };

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { email } = await searchParams;
  return (
    <Card className="p-8 text-center">
      <div className="mx-auto grid size-12 place-items-center rounded-full bg-primary-tint text-primary-text">
        <MailCheck className="size-6" aria-hidden />
      </div>
      <h1 className="mt-4 font-display text-2xl font-bold">Check your email</h1>
      <p className="mt-2 text-sm text-muted">We sent a confirmation link{email ? <> to <strong className="text-text">{email}</strong></> : null}. Open it to finish setting up your account.</p>
      <p className="mt-6 text-sm text-muted">
        Already confirmed?{" "}
        <Link href="/login" className="font-medium text-primary-text hover:underline">
          Sign in
        </Link>
      </p>
    </Card>
  );
}
