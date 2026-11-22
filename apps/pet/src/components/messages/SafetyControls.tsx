"use client";
import { useState, useTransition } from "react";
import { Button } from "@lyra/ui";
import { reportConversationAction, setBlockedAction } from "@/features/messages/actions";

/** Block (only the side that blocked can unblock) and report to the salon's owners. */
export function SafetyControls({ conversationId, path, blockedBy, side, canBlock }: { conversationId: string; path: string; blockedBy: "customer" | "business" | null; side: "customer" | "business"; canBlock: boolean }) {
  const [pending, start] = useTransition();
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState<{ text: string; error: boolean } | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, done: string) =>
    start(async () => {
      const r = await fn();
      setNote(r.ok ? { text: done, error: false } : { text: r.error ?? "Something went wrong.", error: true });
    });
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {canBlock && !blockedBy ? (
          <Button variant="secondary" disabled={pending} onClick={() => run(() => setBlockedAction(conversationId, true, path), "Blocked. No new messages can be sent.")}>
            Block
          </Button>
        ) : null}
        {blockedBy === side ? (
          <Button variant="secondary" disabled={pending} onClick={() => run(() => setBlockedAction(conversationId, false, path), "Unblocked.")}>
            Unblock
          </Button>
        ) : null}
        <Button variant="ghost" aria-expanded={reporting} onClick={() => setReporting(!reporting)}>
          Report
        </Button>
      </div>
      {reporting ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => reportConversationAction({ conversationId, reason }), "Thanks. The salon's owner has been told and will look into it.");
            setReporting(false);
          }}
        >
          <label htmlFor={`report-${conversationId}`} className="text-sm font-semibold text-ink">
            What happened? (optional)
          </label>
          <textarea id={`report-${conversationId}`} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} rows={2} className="rounded-2xl border border-border bg-surface px-3 py-2 text-ink" />
          <Button type="submit" className="self-start" disabled={pending}>
            Send report
          </Button>
        </form>
      ) : null}
      {note ? (
        <p role={note.error ? "alert" : "status"} className={note.error ? "text-sm font-medium text-danger" : "text-sm text-muted"}>
          {note.text}
        </p>
      ) : null}
    </div>
  );
}
