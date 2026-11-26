import type { Metadata } from "next";
import { Check } from "lucide-react";
import { notFound } from "next/navigation";
import { Badge, Card, cn } from "@lyra/ui";
import { Confetti } from "@/components/Confetti";
import { Mascot } from "@/components/mascots/Mascot";
import { PageHeader } from "@/components/PageHeader";
import { CancelRequest } from "@/components/portal/CancelRequest";
import { requestWhen } from "@/components/portal/when";
import { myBookings } from "@/features/portal/queries";
import { ReviewForm } from "@/components/loyalty/ReviewForm";
import { Stars } from "@/components/loyalty/Stars";
import { awardLabel } from "@/features/loyalty/engine";
import { myLoyalty } from "@/features/loyalty/queries";
import { STATUS_TEXT } from "@/features/portal/schemas";
import { formatAud } from "@/features/services/pricing";
import { nowMs } from "@/features/scheduling/time";
import { PayRequest } from "@/components/payments/PayRequest";
import { requestPayments } from "@/features/payments/queries";
import { confirmCheckout } from "@/features/payments/service";
import { markRequestNotificationsRead } from "@/features/notifications/queries";

export const metadata: Metadata = { title: "Your request" };

const JOURNEY = [
  { key: "submitted", label: "Request sent" },
  { key: "awaiting_review", label: "Salon reviewing" },
  { key: "confirmed", label: "Appointment confirmed" },
  { key: "in_progress", label: "Grooming" },
  { key: "completed", label: "Ready for collection" },
] as const;

/** One request: where it's up to, what was asked, and cancel while it's still allowed. */
export default async function RequestPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ new?: string; paid?: string; cancelled?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  // Back from Stripe Checkout: confirm with Stripe now (the webhook may arrive later). Idempotent.
  const justPaid = sp.paid ? await confirmCheckout(id, sp.paid).catch(() => false) : false;
  const [bookings, loyalty] = await Promise.all([myBookings(), myLoyalty()]);
  const r = bookings.requests.find((x) => x.id === id);
  if (!r) notFound();
  // The customer is looking at this request now, so its notices (e.g. "declined") are read.
  await markRequestNotificationsRead(r.id);
  const review = loyalty.reviews.find((v) => v.appointmentId === r.appointmentId);
  const milestone = r.status === "completed" ? loyalty.petAwards.find((a) => a.ownerPetId === r.ownerPetId && a.key.startsWith("grooms_") && r.appointmentStart !== null && Math.abs(Date.parse(a.at) - nowMs()) < 7 * 86_400_000) : undefined;
  const payment = (await requestPayments([r.id])).get(r.id);
  const reached = new Set(r.events.map((e) => e.status));
  const closed = ["cancelled", "rejected", "expired"].includes(r.status);
  const fresh = (sp.new === "1" || justPaid) && ["awaiting_review", "open", "submitted"].includes(r.status);
  const canCancel = ["submitted", "awaiting_review", "open", "accepted"].includes(r.status) || (r.status === "confirmed" && !!r.appointmentStart && Date.parse(r.appointmentStart) - (r.cancellationHours ?? 0) * 3_600_000 > nowMs());
  const fmt = (iso: string) => new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: r.timezone }).format(new Date(iso));
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      {fresh ? <Confetti /> : null}
      <PageHeader title={`${r.petName} at ${r.businessName}`} back={{ href: "/me/bookings", label: "Bookings" }} actions={<Badge tone={STATUS_TEXT[r.status]?.tone ?? "neutral"}>{STATUS_TEXT[r.status]?.label ?? r.status}</Badge>} />
      {fresh ? (
        <section aria-live="polite" className="animate-pop flex flex-col items-center gap-2 rounded-[32px] bg-glow p-8 text-center">
          <Mascot name="coco" mood="excited" pose="wave" className="w-36" />
          <h2 className="font-display text-3xl font-bold text-ink">Your grooming request has been submitted!</h2>
          <p className="text-lg text-ink/80">Your appointment is awaiting acceptance by the grooming team.</p>
        </section>
      ) : null}
      {r.status === "draft" ? (
        <section className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-butter-tint p-5">
          <p className="text-lg font-semibold text-ink">
            {sp.paid && !justPaid ? "We're still waiting for Stripe to confirm your payment. Refresh in a moment." : `${r.businessName} takes payment when you book. Pay ${r.estimateCents !== null ? formatAud(r.estimateCents) : ""} to send your request.`}
          </p>
          {sp.cancelled ? <p className="text-sm text-ink">Payment was cancelled, so your request hasn&apos;t been sent yet.</p> : null}
          <p className="text-sm text-ink/80">If {r.businessName} can&apos;t take it, the request expires or you cancel, you&apos;re refunded in full. Unpaid requests are removed after 2 hours.</p>
          <PayRequest requestId={r.id} label={`Pay ${r.estimateCents !== null ? formatAud(r.estimateCents) : ""} securely`} />
        </section>
      ) : null}
      {r.status === "confirmed" && r.appointmentStart ? (
        <section className="flex items-center gap-4 rounded-[var(--radius-card)] bg-mint-tint p-5">
          <Mascot name="biscuit" mood="excited" className="w-20 shrink-0" />
          <p className="text-lg font-semibold text-ink">
            Good news! {r.petName}&apos;s appointment is confirmed for {requestWhen(r)}
            {r.groomerName ? ` with ${r.groomerName}` : ""}.
          </p>
        </section>
      ) : null}
      {r.status === "completed" ? (
        <>
          {milestone ? <Confetti /> : null}
          <section className="flex items-center gap-4 rounded-[var(--radius-card)] bg-mint-tint p-5">
            <Mascot name="coco" mood="proud" className="w-20 shrink-0" />
            <div>
              <p className="text-lg font-semibold text-ink">Woof! {r.petName} is all done. Thanks for visiting {r.businessName}.</p>
              {milestone ? <p className="animate-pop mt-1 font-bold text-ink">{awardLabel(milestone.key, r.petName).body}</p> : null}
            </div>
          </section>
          {r.appointmentId ? (
            <Card>
              <h2 className="font-display text-xl font-semibold text-ink">Your review</h2>
              <div className="mt-3">
                {review ? (
                  <div className="flex flex-col gap-1">
                    <Stars rating={review.rating} />
                    {review.comment ? <p className="text-ink">{review.comment}</p> : null}
                    {review.reply ? <p className="text-sm text-muted">{r.businessName} replied: {review.reply}</p> : null}
                  </div>
                ) : (
                  <ReviewForm appointmentId={r.appointmentId} petName={r.petName} />
                )}
              </div>
            </Card>
          ) : null}
        </>
      ) : null}
      {r.status === "rejected" ? (
        <section className="flex items-center gap-4 rounded-[var(--radius-card)] bg-coral-tint p-5">
          <Mascot name="luna" mood="sleepy" className="w-20 shrink-0" />
          <p className="font-semibold text-ink">{r.businessName} couldn&apos;t take this request{r.decisionReason ? `: ${r.decisionReason.trim().replace(/[.!?]+$/, "")}.` : "."} You can request another time or try a different salon.</p>
        </section>
      ) : null}

      {!closed ? (
        <Card>
          <h2 className="font-display text-xl font-semibold text-ink">Progress</h2>
          <ol className="mt-4 flex flex-col gap-3">
            {JOURNEY.map((j) => {
              const done = reached.has(j.key);
              const event = r.events.findLast((e) => e.status === j.key);
              return (
                <li key={j.key} className="flex items-center gap-3">
                  <span className={cn("grid size-8 shrink-0 place-items-center rounded-full", done ? "bg-primary text-white" : "bg-surface-2 text-muted")}>{done ? <Check className="size-4" aria-hidden /> : null}</span>
                  <span className={cn("font-semibold", done ? "text-ink" : "text-muted")}>
                    {j.label}
                    <span className="sr-only">{done ? " (done)" : " (not yet)"}</span>
                  </span>
                  {event ? <span className="ml-auto text-xs text-muted tabular">{fmt(event.at)}</span> : null}
                </li>
              );
            })}
          </ol>
        </Card>
      ) : null}

      <Card>
        <h2 className="font-display text-xl font-semibold text-ink">Details</h2>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-[10rem_1fr]">
          <dt className="text-muted">Services</dt>
          <dd className="font-semibold text-ink">{r.services.join(", ")}</dd>
          <dt className="text-muted">When</dt>
          <dd className="font-semibold text-ink">{requestWhen(r)}</dd>
          <dt className="text-muted">Estimate</dt>
          <dd className="font-semibold text-ink">{r.estimateCents !== null ? `${r.estimateFrom ? "from " : ""}${formatAud(r.estimateCents)} · about ${r.minutes} min` : `About ${r.minutes} min`}</dd>
          {payment && payment.status !== "pending" && payment.status !== "expired" && payment.status !== "failed" ? (
            <>
              <dt className="text-muted">Payment</dt>
              <dd className="font-semibold text-ink">{payment.status === "paid" ? `Paid ${formatAud(payment.amount)}` : payment.status === "refunded" ? `Refunded ${formatAud(payment.amount)}` : `Refund of ${formatAud(payment.amount)} on its way`}</dd>
            </>
          ) : null}
          {r.notes ? (
            <>
              <dt className="text-muted">Your notes</dt>
              <dd className="text-ink">{r.notes}</dd>
            </>
          ) : null}
        </dl>
        {canCancel ? (
          <div className="mt-5">
            <CancelRequest id={r.id} confirmed={r.status === "confirmed"} />
          </div>
        ) : null}
        {r.status === "confirmed" && !canCancel ? <p className="mt-4 text-sm text-muted">It&apos;s inside the salon&apos;s {r.cancellationHours}-hour cancellation window. Please contact {r.businessName} to change it.</p> : null}
      </Card>
    </div>
  );
}
