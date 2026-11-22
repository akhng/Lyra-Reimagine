import Link from "next/link";
import { Badge, cn } from "@lyra/ui";

export type ConversationItem = { id: string; href: string; title: string; preview: string | null; at: string | null; unread: boolean; blocked: boolean; reports?: number };

/** A list of conversations, newest first, unread ones highlighted. */
export function ConversationList({ items, timezone }: { items: ConversationItem[]; timezone: string }) {
  const fmt = (iso: string) => new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: timezone }).format(new Date(iso));
  return (
    <ul className="flex flex-col gap-2">
      {items.map((c) => (
        <li key={c.id}>
          <Link href={c.href} className={cn("lift flex items-center gap-3 rounded-[var(--radius-card)] p-4 shadow-[var(--shadow-card)]", c.unread ? "bg-primary-tint" : "bg-surface")}>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-display text-lg font-semibold text-ink">{c.title}</span>
                {c.unread ? <Badge tone="coral">New</Badge> : null}
                {c.blocked ? <Badge tone="neutral">Blocked</Badge> : null}
                {c.reports ? <Badge tone="warning">Reported</Badge> : null}
              </span>
              <span className="block truncate text-sm text-muted">{c.preview ?? "No messages yet"}</span>
            </span>
            {c.at ? <span className="shrink-0 text-xs text-muted tabular">{fmt(c.at)}</span> : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}
