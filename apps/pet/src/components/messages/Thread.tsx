"use client";
import { Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button, cn } from "@lyra/ui";
import { createSupabaseBrowserClient } from "@lyra/platform/supabase/browser";
import { sendMessageAction } from "@/features/messages/actions";
import { MESSAGE_MAX, type ChatMessage } from "@/features/messages/schemas";

/**
 * A conversation (ADR 0005): messages oldest first, the viewer's own on the
 * right, and a composer. New messages arrive through Supabase Realtime (RLS
 * applies), with a slow refresh as a fallback; the server stays the source of truth.
 */
export function Thread({
  conversationId,
  messages,
  viewer,
  timezone,
  canSend,
  disabledReason,
}: {
  conversationId: string;
  messages: ChatMessage[];
  viewer: "customer" | "staff";
  timezone: string;
  canSend: boolean;
  disabledReason?: string;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  useEffect(() => {
    const db = createSupabaseBrowserClient();
    let channel: ReturnType<typeof db.channel> | null = null;
    let cancelled = false;
    // Subscribe as the signed-in person (RLS decides what arrives), not anonymously.
    void db.auth.getSession().then(({ data }) => {
      if (cancelled || !data.session) return;
      void db.realtime.setAuth(data.session.access_token);
      channel = db
        .channel(`chat:${conversationId}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `conversation_id=eq.${conversationId}` }, () => router.refresh())
        .subscribe();
    });
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      if (channel) void db.removeChannel(channel);
    };
  }, [conversationId, router]);

  const send = () => {
    if (!body.trim() || pending) return;
    start(async () => {
      const r = await sendMessageAction({ conversationId, body });
      if (!r.ok) return setError(r.error);
      setError(null);
      setBody("");
      router.refresh();
    });
  };
  const fmt = (iso: string) =>
    new Intl.DateTimeFormat("en-AU", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
      timeZone: timezone,
    }).format(new Date(iso));

  return (
    <div className="flex flex-col gap-4">
      {/* Focusable so keyboard users can scroll the history. */}
      <div
        role="region"
        aria-label="Conversation"
        tabIndex={0}
        className="max-h-[60dvh] min-h-48 overflow-y-auto rounded-[var(--radius-card)] bg-surface-2 p-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <ol
          aria-label="Messages"
          aria-live="polite"
          className="flex min-h-40 flex-col gap-3"
        >
          {messages.length ? (
            messages.map((m) => {
              const mine = m.senderKind === viewer;
              return (
                <li
                  key={m.id}
                  className={cn(
                    "flex max-w-[85%] flex-col gap-1",
                    mine ? "items-end self-end" : "items-start self-start",
                  )}
                >
                  <span className="text-xs text-muted">
                    {mine ? "You" : m.senderName} ·{" "}
                    <time dateTime={m.createdAt}>{fmt(m.createdAt)}</time>
                  </span>
                  <p
                    className={cn(
                      "rounded-3xl px-4 py-2.5 whitespace-pre-wrap break-words shadow-[var(--shadow-card)]",
                      mine
                        ? "rounded-br-lg bg-primary text-white"
                        : "rounded-bl-lg bg-surface text-ink",
                    )}
                  >
                    {m.body}
                  </p>
                  {m.masked ? (
                    <span className="text-xs text-muted">
                      Contact details hidden until a booking is paid through
                      Lyra Pet.
                    </span>
                  ) : null}
                </li>
              );
            })
          ) : (
            <li className="m-auto text-center text-sm text-muted">
              No messages yet. Say hello!
            </li>
          )}
        </ol>
        <div ref={end} />
      </div>
      {canSend ? (
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <label htmlFor={`msg-${conversationId}`} className="sr-only">
            Message
          </label>
          <textarea
            id={`msg-${conversationId}`}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={2}
            maxLength={MESSAGE_MAX}
            placeholder="Write a message…"
            className="min-h-12 flex-1 resize-y rounded-3xl border border-border bg-surface px-4 py-3 text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          />
          <Button
            type="submit"
            disabled={pending || !body.trim()}
            aria-label="Send message"
          >
            <Send className="size-4" aria-hidden />{" "}
            <span className="hidden sm:inline">
              {pending ? "Sending…" : "Send"}
            </span>
          </Button>
        </form>
      ) : (
        <p className="rounded-2xl bg-butter-tint p-4 text-sm font-semibold text-ink">
          {disabledReason}
        </p>
      )}
      {error ? (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
