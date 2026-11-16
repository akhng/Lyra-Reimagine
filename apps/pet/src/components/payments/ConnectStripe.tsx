"use client";
import { useState, useTransition } from "react";
import { Button } from "@lyra/ui";
import { connectStripeAction } from "@/features/payments/actions";

export function ConnectStripe({ slug, label }: { slug: string; label: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <Button className="self-start" disabled={pending} onClick={() => start(async () => { const r = await connectStripeAction(slug); if (r && !r.ok) setError(r.error); })}>
        {pending ? "Opening Stripe…" : label}
      </Button>
      {error ? <p role="alert" className="text-sm font-semibold text-danger">{error}</p> : null}
    </div>
  );
}
