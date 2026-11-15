import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EmptyState } from "@lyra/ui";
import { BookingFlow } from "@/components/booking/BookingFlow";
import { getBookingContext } from "@/features/booking/queries";
import { Mascot } from "@/components/mascots/Mascot";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const ctx = await getBookingContext((await params).slug, 1);
  return { title: ctx ? `Book with ${ctx.business.name}` : "Book", robots: { index: !!ctx?.online } };
}

/** /book/[slug] — the salon's public booking page (no account needed). */
export default async function BookPage({ params }: Props) {
  const { slug } = await params;
  if (!/^[a-z0-9-]{3,40}$/.test(slug)) notFound();
  const ctx = await getBookingContext(slug);
  if (!ctx) notFound();
  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-sm font-medium text-primary-text">Book online</p>
        <h1 className="font-display text-3xl font-bold text-ink sm:text-4xl">{ctx.business.name}</h1>
      </header>
      {ctx.online ? (
        // eslint-disable-next-line react-hooks/purity -- the request time anchors the available slots for this render
        <BookingFlow ctx={ctx} nowMs={Date.now()} />
      ) : (
        <EmptyState art={<Mascot name="luna" mood="curious" className="w-28" />} title="Online booking isn't available" description={`${ctx.business.name} isn't taking online bookings at the moment.${ctx.business.phone ? ` Call ${ctx.business.phone} to book.` : ctx.business.email ? ` Email ${ctx.business.email} to book.` : ""}`} />
      )}
    </div>
  );
}
