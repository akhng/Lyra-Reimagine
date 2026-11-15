"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, FormField, Input } from "@lyra/ui";
import { cancelRequestAction } from "@/features/portal/actions";

/** Cancel a request (or its confirmed appointment, inside the salon's window), with an optional reason. */
export function CancelRequest({ id, confirmed }: { id: string; confirmed: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!open)
    return (
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        {confirmed ? "Cancel appointment" : "Cancel request"}
      </Button>
    );
  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border-2 border-dashed border-border p-4">
      <FormField id="cancel-reason" label="Reason (optional)">
        {(p) => <Input {...p} value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />}
      </FormField>
      {error ? (
        <p role="alert" className="text-sm font-semibold text-danger">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button type="button" variant="danger" disabled={pending} onClick={() => start(async () => { const r = await cancelRequestAction(id, reason); if (r.ok) router.refresh(); else setError(r.error ?? "Something went wrong."); })}>
          {pending ? "Cancelling…" : "Yes, cancel"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Keep it
        </Button>
      </div>
    </div>
  );
}
