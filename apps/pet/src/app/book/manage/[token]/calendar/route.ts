import { getBookingByToken } from "@/features/booking/queries";
import { icsEvent } from "@/features/booking/ics";

/** "Add to calendar": the booking as an .ics file (private link only). */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const b = await getBookingByToken(token);
  if (!b || b.status === "cancelled") return new Response("Not found", { status: 404 });
  const body = icsEvent({
    uid: b.id,
    startsAt: b.startsAt,
    endsAt: b.endsAt,
    title: `${b.pet}'s groom at ${b.business.name}`,
    location: [b.location.name, b.location.addressLine, b.location.suburb].filter(Boolean).join(", ") || null,
    description: `${b.services.map((s) => s.name).join(", ")} with ${b.groomer}.${b.business.phone ? ` Questions: ${b.business.phone}.` : ""}`,
  });
  return new Response(body, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="booking-${b.business.slug}.ics"`, "Cache-Control": "private, no-store" } });
}
