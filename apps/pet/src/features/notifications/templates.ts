/**
 * Friendly, pet-oriented notification text (ADR 0003). Pure: the database
 * stores a kind and a small payload; wording lives here so it can change
 * without touching stored rows, and the same text can later go out by email
 * or SMS.
 */
export type NotificationData = { requestId?: string; businessName?: string; businessSlug?: string; timezone?: string; petName?: string; startsAt?: string | null; groomerName?: string | null; appointmentId?: string | null; services?: string[] };
export type Rendered = { title: string; body: string; mascot: "coco" | "mochi" | "biscuit" | "luna"; mood: "happy" | "excited" | "curious" | "proud" | "sleepy" };

export function when(iso: string | null | undefined, tz = "Australia/Melbourne"): string | null {
  if (!iso) return null;
  return new Intl.DateTimeFormat("en-AU", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: tz }).format(new Date(iso));
}

export function renderNotification(kind: string, d: NotificationData): Rendered {
  const pet = d.petName ?? "Your pet";
  const at = when(d.startsAt, d.timezone);
  const salon = d.businessName ?? "the salon";
  switch (kind) {
    case "request_new":
      return { title: `New request for ${pet}`, body: `${(d.services ?? []).join(", ") || "A groom"}${at ? ` · asked for ${at}` : ""}.`, mascot: "luna", mood: "curious" };
    case "request_open":
      return { title: `${pet} needs a groomer`, body: `${(d.services ?? []).join(", ") || "A groom"}${at ? ` · ${at}` : ""}. Open the shift board to accept.`, mascot: "biscuit", mood: "excited" };
    case "request_assigned":
      return { title: `${pet} has been assigned to you`, body: `Accept it on the shift board${at ? ` · ${at}` : ""}.`, mascot: "biscuit", mood: "curious" };
    case "request_accepted":
      return { title: `${d.groomerName ?? "A groomer"} accepted ${pet}`, body: `${at ? `${at} · ` : ""}It's in the calendar.`, mascot: "coco", mood: "happy" };
    case "request_unclaimed":
      return { title: `Nobody has taken ${pet} yet`, body: "The acceptance deadline passed, so the request is back with the front desk.", mascot: "luna", mood: "sleepy" };
    case "request_cancelled":
      return { title: `${pet}'s request was cancelled`, body: "The customer cancelled it.", mascot: "mochi", mood: "sleepy" };
    case "request_confirmed":
      return { title: `Good news! ${pet}'s grooming appointment has been accepted${d.groomerName ? ` by ${d.groomerName}` : ""}.`, body: `${salon}${at ? ` · ${at}` : ""}`, mascot: "coco", mood: "excited" };
    case "request_rejected":
      return { title: `${salon} couldn't take ${pet}'s request`, body: "You can ask for another time or try a different salon.", mascot: "luna", mood: "sleepy" };
    case "request_expired":
      return { title: `${pet}'s request expired`, body: `The requested time passed before ${salon} could confirm it.`, mascot: "luna", mood: "sleepy" };
    case "request_cancelled_by_salon":
      return { title: `${salon} cancelled ${pet}'s appointment`, body: "Contact the salon, or request another time.", mascot: "mochi", mood: "sleepy" };
    case "grooming_started":
      return { title: `${pet} is being pampered!`, body: `Grooming has started at ${salon}.`, mascot: "mochi", mood: "happy" };
    case "grooming_completed":
      return { title: `Woof! ${pet} is ready for collection!`, body: `All done at ${salon}.`, mascot: "coco", mood: "proud" };
    case "appointment_reminder":
      return { title: `Reminder: ${pet}'s groom${at ? ` ${at}` : " is coming up"}`, body: `At ${salon}. See you soon!`, mascot: "biscuit", mood: "happy" };
    default:
      return { title: "Update", body: salon, mascot: "coco", mood: "happy" };
  }
}

/** Where a notification leads. */
export function notificationHref(kind: string, d: NotificationData, audience: "customer" | "staff", slug?: string): string {
  if (audience === "customer") return d.requestId ? `/me/requests/${d.requestId}` : "/me/bookings";
  if (kind === "request_open" || kind === "request_assigned") return `/b/${slug}/shifts`;
  if (kind === "request_accepted" && d.appointmentId) return `/b/${slug}/appointments/${d.appointmentId}`;
  return `/b/${slug}/requests`;
}
