"use client";
import { useTransition } from "react";
import { Button } from "@lyra/ui";
import { closeRequestAction } from "@/features/shifts/actions";

/** Take an open request back from the shift board. */
export function CloseRequest({ slug, requestId }: { slug: string; requestId: string }) {
  const [pending, start] = useTransition();
  return (
    <Button type="button" variant="secondary" size="sm" disabled={pending} onClick={() => start(async () => void (await closeRequestAction(slug, requestId)))}>
      {pending ? "Taking back…" : "Take back from shift board"}
    </Button>
  );
}
