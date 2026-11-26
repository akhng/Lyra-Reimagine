"use client";
import { X } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";
import { buttonVariants } from "@lyra/ui";
import { Mascot } from "@/components/mascots/Mascot";
import { markNotificationsReadAction } from "@/features/notifications/actions";
import { renderNotification, type NotificationData } from "@/features/notifications/templates";

export type DeclinedNotice = { id: number; data: NotificationData };

/**
 * Unread "the salon couldn't take your request" notices at the top of the pet
 * owner's home. They appear live (LiveNotifications refreshes the page when
 * one is written) and stay until opened or dismissed.
 */
export function DeclinedNotices({ notices }: { notices: DeclinedNotice[] }) {
  return (
    // Polite live region: a notice arriving while the page is open is read out by screen readers.
    <div aria-live="polite" className="flex flex-col gap-3 empty:hidden">
      {notices.map((n) => (
        <Notice key={n.id} notice={n} />
      ))}
    </div>
  );
}

function Notice({ notice }: { notice: DeclinedNotice }) {
  const [pending, start] = useTransition();
  const r = renderNotification("request_rejected", notice.data);
  const href = notice.data.requestId ? `/me/requests/${notice.data.requestId}` : "/me/bookings";
  return (
    <section aria-label="Booking update" className="animate-pop relative flex items-center gap-4 rounded-[var(--radius-card)] bg-coral-tint p-4 pr-14 shadow-[var(--shadow-card)] sm:p-5 sm:pr-16">
      <Mascot name={r.mascot} mood={r.mood} className="hidden w-16 shrink-0 sm:block" />
      <div className="flex flex-1 flex-col gap-2">
        <p className="font-display text-lg font-semibold text-ink">{r.title}</p>
        <p className="text-sm text-ink/80">{r.body}</p>
        <Link href={href} className={buttonVariants({ variant: "secondary", size: "sm", className: "self-start" })}>
          See request
        </Link>
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => void (await markNotificationsReadAction([notice.id], "customer", "/me")))}
        className="absolute top-2 right-2 grid size-11 place-items-center rounded-full text-ink hover:bg-white/60 disabled:opacity-50"
        aria-label={`Dismiss: ${r.title}`}
      >
        <X className="size-5" aria-hidden />
      </button>
    </section>
  );
}
