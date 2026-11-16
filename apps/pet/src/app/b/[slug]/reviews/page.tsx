import type { Metadata } from "next";
import { EmptyState } from "@lyra/ui";
import { requireBusiness } from "@lyra/platform/tenancy/context";
import { can } from "@lyra/platform/tenancy/roles";
import { ReviewReply } from "@/components/loyalty/ReviewReply";
import { Stars } from "@/components/loyalty/Stars";
import { Mascot } from "@/components/mascots/Mascot";
import { PageHeader } from "@/components/PageHeader";
import { reviewSummary } from "@/features/loyalty/queries";

export const metadata: Metadata = { title: "Reviews" };

/** Reviews from customers of completed appointments, with replies by owners and managers. */
export default async function Reviews({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { business, role } = await requireBusiness(slug);
  const { count, average, reviews } = await reviewSummary(business.id);
  const canReply = can(role, "business.edit");
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <PageHeader title="Customer reviews" description="Customers can review an appointment once it's completed." />
      {count ? (
        <>
          <section className="flex flex-wrap items-center gap-4 rounded-[var(--radius-card)] bg-butter-tint p-5">
            <Mascot name="coco" mood={average !== null && average >= 4.5 ? "proud" : "happy"} className="w-20" />
            <div>
              <p className="font-display text-4xl font-bold text-ink tabular">{average?.toFixed(1)}</p>
              <Stars rating={average ?? 0} />
              <p className="text-sm text-ink/80">{count} review{count === 1 ? "" : "s"}</p>
            </div>
          </section>
          <ul className="flex flex-col gap-3">
            {reviews.map((r) => (
              <li key={r.id} className="flex flex-col gap-2 rounded-[var(--radius-card)] bg-surface p-5 shadow-[var(--shadow-card)]">
                <div className="flex flex-wrap items-center gap-3">
                  <Stars rating={r.rating} />
                  <span className="font-semibold text-ink">{r.petName}</span>
                  <span className="text-xs text-muted">{new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: business.timezone }).format(new Date(r.createdAt))}</span>
                </div>
                {r.comment ? <p className="text-ink">{r.comment}</p> : <p className="text-sm text-muted">No comment.</p>}
                {canReply ? <ReviewReply slug={slug} reviewId={r.id} reply={r.reply} /> : r.reply ? <p className="text-sm text-muted">Reply: {r.reply}</p> : null}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <EmptyState art={<Mascot name="mochi" mood="curious" className="w-28" />} title="No reviews yet" description="Pet owners with a Lyra Pet account are invited to review each completed groom." />
      )}
    </div>
  );
}
