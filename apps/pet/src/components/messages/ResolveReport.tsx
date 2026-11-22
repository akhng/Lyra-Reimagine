"use client";
import { useTransition } from "react";
import { Button } from "@lyra/ui";
import { resolveReportAction } from "@/features/messages/actions";

export function ResolveReport({ reportId, path }: { reportId: string; path: string }) {
  const [pending, start] = useTransition();
  return (
    <Button variant="secondary" className="self-start" disabled={pending} onClick={() => start(async () => void (await resolveReportAction(reportId, path)))}>
      {pending ? "Saving…" : "Mark as handled"}
    </Button>
  );
}
