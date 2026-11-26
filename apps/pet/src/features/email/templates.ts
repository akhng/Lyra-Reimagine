import { when, type NotificationData } from "../notifications/templates";
import { formatAud } from "../services/pricing";

/**
 * Customer emails (pure: kind + stored payload in, subject and bodies out).
 * Plain, friendly copy in Australian English; no customer contact details or
 * pet care notes beyond the pet's name, which the customer gave us. Only the
 * salon's own details (location, phone) appear.
 */
export type EmailData = NotificationData & {
  // Declined
  reason?: string | null;
  refund?: boolean;
  // Accepted
  locationName?: string | null;
  address?: string | null;
  phone?: string | null;
  estimateCents?: number | null;
  estimateFrom?: boolean;
  paid?: boolean;
  cancellationHours?: number;
};
export type RenderedEmail = { subject: string; text: string; html: string };
type Opts = { appUrl: string; firstName?: string | null };

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** One block of an email: plain text for the text part, and the same words for HTML (bold label optional). */
type Block = { text: string; label?: string };

function build(subject: string, opts: Opts, blocks: Block[], link: { href: string; label: string; intro: string }): RenderedEmail {
  const hi = `Hi ${opts.firstName?.trim() || "there"},`;
  const text = [hi, ...blocks.map((b) => (b.label ? `${b.label}: ${b.text}` : b.text)), `${link.intro}:`, link.href, "The Lyra Pet team"].join("\n\n");
  // Email clients ignore stylesheets and CSS variables, so styles are inline (mirrors --ink and --primary in globals.css).
  const p = (s: string) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.5;color:#2e1f4f">${s}</p>`;
  const html = [
    `<div style="font-family:Nunito,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px">`,
    p(escape(hi)),
    ...blocks.map((b) => p(b.label ? `<strong>${escape(b.label)}:</strong> ${escape(b.text)}` : escape(b.text))),
    p(`${escape(link.intro)}.`),
    `<p style="margin:0 0 24px"><a href="${escape(link.href)}" style="display:inline-block;padding:12px 24px;border-radius:999px;background:#6a45dd;color:#ffffff;font-weight:700;text-decoration:none">${escape(link.label)}</a></p>`,
    p("The Lyra Pet team"),
    `</div>`,
  ].join("");
  return { subject, text, html };
}

export function renderEmail(kind: string, d: EmailData, opts: Opts): RenderedEmail | null {
  const pet = d.petName ?? "your pet";
  const salon = d.businessName ?? "The salon";
  const at = when(d.startsAt, d.timezone);
  const services = (d.services ?? []).join(", ");
  const link = d.requestId ? `${opts.appUrl}/me/requests/${d.requestId}` : `${opts.appUrl}/me/bookings`;

  if (kind === "request_rejected") {
    const reason = d.reason?.trim() || null;
    return build(
      `${salon} couldn't take ${pet}'s grooming request`,
      opts,
      [
        { text: `${salon} has let us know they can't take ${pet}'s request${services ? ` for ${services}` : ""}${at ? ` on ${at}` : ""}.` },
        ...(reason ? [{ text: `Their message: "${reason}"` }] : []),
        ...(d.refund ? [{ text: "You've been refunded in full, including the service fee. Refunds usually reach your card within 5 to 10 business days." }] : []),
      ],
      { href: link, label: "See your request", intro: "You can ask for another time or try a different salon" },
    );
  }

  if (kind === "request_confirmed") {
    const where = [d.locationName, d.address].filter(Boolean).join(", ");
    const price = d.estimateCents != null ? `${d.estimateFrom ? "From " : ""}${formatAud(d.estimateCents)}` : null;
    const hours = d.cancellationHours ?? 0;
    return build(
      `Booked! ${pet}'s groom at ${salon}${at ? ` on ${at}` : ""}`,
      opts,
      [
        { text: `Good news: ${salon} has accepted ${pet}'s grooming request${d.groomerName ? ` with ${d.groomerName}` : ""}.` },
        ...(at ? [{ label: "When", text: at }] : []),
        ...(where ? [{ label: "Where", text: where }] : []),
        ...(services ? [{ label: "Services", text: services }] : []),
        ...(price ? [{ label: "Price", text: d.paid ? `${price}, paid in the app` : `${price}, to pay at the salon${d.estimateFrom ? " (the final price may change after the salon sees your pet)" : ""}` }] : []),
        { text: `Need to cancel? You can cancel in the app${hours > 0 ? ` up to ${hours} hour${hours === 1 ? "" : "s"} before the appointment` : " before the appointment"}${d.paid ? " and get a full refund" : ""}.${d.phone ? ` For anything else, call ${salon} on ${d.phone}.` : ""}` },
      ],
      { href: link, label: "See your booking", intro: "Your booking details are in the app" },
    );
  }

  return null;
}
