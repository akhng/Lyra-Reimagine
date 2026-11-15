import { Bell as BellIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@lyra/ui";

/** The notifications link with an unread count (rendered on the server; refreshes with navigation). */
export function Bell({ href, count, inverted = false }: { href: string; count: number; inverted?: boolean }) {
  return (
    <Link href={href} aria-label={count ? `Notifications, ${count} unread` : "Notifications"} className={cn("relative grid size-11 shrink-0 place-items-center rounded-full", inverted ? "text-white hover:bg-white/10" : "text-ink hover:bg-surface-2")}>
      <BellIcon className="size-5" aria-hidden />
      {count ? <span aria-hidden className="absolute top-1.5 right-1.5 grid min-w-5 place-items-center rounded-full bg-coral-text px-1 text-[11px] font-bold text-white tabular">{count > 9 ? "9+" : count}</span> : null}
    </Link>
  );
}
