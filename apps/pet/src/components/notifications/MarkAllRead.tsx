"use client";
import { useTransition } from "react";
import { Button } from "@lyra/ui";
import { markNotificationsReadAction } from "@/features/notifications/actions";

export function MarkAllRead({ audience, path, count }: { audience: "customer" | "staff"; path: string; count: number }) {
  const [pending, start] = useTransition();
  return (
    <Button type="button" variant="secondary" size="sm" className="self-start" disabled={pending} onClick={() => start(async () => void (await markNotificationsReadAction("all", audience, path)))}>
      {pending ? "Marking…" : `Mark ${count} as read`}
    </Button>
  );
}
