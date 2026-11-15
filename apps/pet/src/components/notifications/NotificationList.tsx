import Link from "next/link";
import { cn, EmptyState } from "@lyra/ui";
import { Mascot } from "@/components/mascots/Mascot";
import type { AppNotification } from "@/features/notifications/queries";
import { notificationHref, renderNotification } from "@/features/notifications/templates";
import { MarkAllRead } from "./MarkAllRead";

const ago = (iso: string, now: number) => {
  const m = Math.round((now - Date.parse(iso)) / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short" }).format(new Date(iso));
};

/** In-app notifications as friendly cards with a mascot; unread ones stand out. */
export function NotificationList({ items, audience, slug, path, now }: { items: AppNotification[]; audience: "customer" | "staff"; slug?: string; path: string; now: number }) {
  const unread = items.filter((n) => !n.readAt).length;
  if (!items.length) return <EmptyState art={<Mascot name="mochi" mood="sleepy" className="w-28" />} title="No notifications yet" description={audience === "customer" ? "Updates about your requests and appointments appear here." : "New requests, accepted shifts and cancellations appear here."} />;
  return (
    <div className="flex flex-col gap-3">
      {unread ? <MarkAllRead audience={audience} path={path} count={unread} /> : null}
      <ul className="flex flex-col gap-2">
        {items.map((n) => {
          const r = renderNotification(n.kind, n.data);
          return (
            <li key={n.id}>
              <Link href={notificationHref(n.kind, n.data, audience, slug)} className={cn("lift flex items-start gap-3 rounded-[var(--radius-card)] p-4 shadow-[var(--shadow-card)]", n.readAt ? "bg-surface" : "bg-primary-tint")}>
                <Mascot name={r.mascot} mood={r.mood} pose="peek" className="w-12 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-ink">
                    {!n.readAt ? <span className="sr-only">Unread: </span> : null}
                    {r.title}
                  </span>
                  <span className="block text-sm text-ink/80">{r.body}</span>
                </span>
                <span className="shrink-0 text-xs text-muted">{ago(n.createdAt, now)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
