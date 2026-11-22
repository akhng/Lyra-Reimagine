"use client";
import { MessageCircle } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@lyra/ui";
import { startConversationAction } from "@/features/messages/actions";

/** "Message" on a salon's listing: opens (or starts) the private conversation. No booking needed. */
export function MessageSalonButton({ slug, name }: { slug: string; name: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="flex flex-col items-end gap-1">
      <Button
        variant="secondary"
        disabled={pending}
        aria-label={`Message ${name}`}
        onClick={() =>
          start(async () => {
            const r = await startConversationAction(slug);
            if (r && !r.ok) setError(r.error);
          })
        }
      >
        <MessageCircle className="size-4" aria-hidden /> Message
      </Button>
      {error ? (
        <span role="alert" className="text-xs font-medium text-danger">
          {error}
        </span>
      ) : null}
    </span>
  );
}
