"use client";
import { useTransition } from "react";
import { Button } from "@lyra/ui";
import { fakePayAction } from "@/features/payments/actions";

export function FakePayButton({ session, next }: { session: string; next: string }) {
  const [pending, start] = useTransition();
  return (
    <Button disabled={pending} onClick={() => start(async () => { await fakePayAction(session); window.location.assign(next); })}>
      {pending ? "Paying…" : "Pay (test)"}
    </Button>
  );
}
