"use client";
import { useState, useTransition } from "react";
import { Button } from "@lyra/ui";
import { payRequestAction } from "@/features/payments/actions";

export function PayRequest({ requestId, label }: { requestId: string; label: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <Button className="self-start" disabled={pending} onClick={() => start(async () => { const r = await payRequestAction(requestId); if (r && !r.ok) setError(r.error); })}>
        {pending ? "Opening secure checkout…" : label}
      </Button>
      {error ? <p role="alert" className="text-sm font-medium text-danger">{error}</p> : null}
    </div>
  );
}
