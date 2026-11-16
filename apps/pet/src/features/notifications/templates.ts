/**
 * Friendly, pet-oriented notification text (ADR 0003). Pure: the database
 * stores a kind and a small payload; wording lives here so it can change
 * without touching stored rows, and the same text can later go out by email
 * or SMS.
 */
export type NotificationData = { key?: string; points?: number; count?: number; rating?: number; requestId?: string; businessName?: string; businessSlug?: string; timezone?: string; petName?: string; startsAt?: string | null; groomerName?: string | null; appointmentId?: string | null; services?: string[] };
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
    case "points_earned":
      return { title: `+${d.points ?? 0} loyalty points!`, body: `For ${pet}'s groom at ${salon}.`, mascot: "biscuit", mood: "excited" };
    case "birthday":
      return { title: `Happy birthday, ${pet}!`, body: `${salon} sent ${d.points ?? 0} birthday points.`, mascot: "mochi", mood: "excited" };
    case "achievement":
      return d.petName
        ? { title: d.count === 1 ? `${pet}'s first groom!` : `Congratulations! ${pet} has completed ${d.count ?? ""} grooming sessions!`, body: `A new milestone at ${salon}.`, mascot: "luna", mood: "proud" }
        : { title: "Achievement unlocked!", body: achievementTitle(d.key), mascot: "coco", mood: "proud" };
    case "review_new":
      return { title: `New ${d.rating ?? ""}-star review`, body: `For ${pet}'s groom.`, mascot: "coco", mood: "happy" };
    default:
      return { title: "Update", body: salon, mascot: "coco", mood: "happy" };
  }
}

function achievementTitle(key?: string): string {
  const names: Record<string, string> = { first_10: "First 10 Grooming Appointments", completed_100: "100 Completed Appointments", happy_pets_50: "50 Happy Pets", loyalty_hero: "Customer Loyalty Hero", online_star: "Online Booking Star", history_keeper: "History Keeper", five_star: "Five-Star Grooming Champion" };
  return (key && names[key]) || "A new business milestone.";
}

/** Where a notification leads. */
export function notificationHref(kind: string, d: NotificationData, audience: "customer" | "staff", slug?: string): string {
  if (audience === "customer") {
    if (kind === "points_earned" || kind === "birthday" || kind === "achievement") return "/me/rewards";
    return d.requestId ? `/me/requests/${d.requestId}` : "/me/bookings";
  }
  if (kind === "review_new") return `/b/${slug}/reviews`;
  if (kind === "achievement") return `/b/${slug}`;
  if (kind === "request_open" || kind === "request_assigned") return `/b/${slug}/shifts`;
  if (kind === "request_accepted" && d.appointmentId) return `/b/${slug}/appointments/${d.appointmentId}`;
  return `/b/${slug}/requests`;
}
