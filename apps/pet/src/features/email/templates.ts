import { when, type NotificationData } from "../notifications/templates";

/**
 * Customer emails (pure: kind + stored payload in, subject and bodies out).
 * Plain, friendly copy in Australian English; no customer contact details or
 * pet care notes beyond the pet's name, which the customer gave us.
 */
export type EmailData = NotificationData & { reason?: string | null; refund?: boolean };
export type RenderedEmail = { subject: string; text: string; html: string };

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

export function renderEmail(kind: string, d: EmailData, opts: { appUrl: string; firstName?: string | null }): RenderedEmail | null {
  if (kind !== "request_rejected") return null;
  const pet = d.petName ?? "your pet";
  const salon = d.businessName ?? "The salon";
  const at = when(d.startsAt, d.timezone);
  const services = (d.services ?? []).join(", ");
  const link = d.requestId ? `${opts.appUrl}/me/requests/${d.requestId}` : `${opts.appUrl}/me/bookings`;
  const reason = d.reason?.trim() || null;

  const subject = `${salon} couldn't take ${pet}'s grooming request`;
  const lines = [
    `Hi ${opts.firstName?.trim() || "there"},`,
    `${salon} has let us know they can't take ${pet}'s request${services ? ` for ${services}` : ""}${at ? ` on ${at}` : ""}.`,
    ...(reason ? [`Their message: "${reason}"`] : []),
    ...(d.refund ? ["You've been refunded in full, including the service fee. Refunds usually reach your card within 5 to 10 business days."] : []),
    "You can ask for another time or try a different salon:",
    link,
    "The Lyra Pet team",
  ];
  const text = lines.join("\n\n");

  // Email clients ignore stylesheets and CSS variables, so styles are inline (mirrors --ink and --primary in globals.css).
  const p = (s: string) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.5;color:#2e1f4f">${s}</p>`;
  const html = [
    `<div style="font-family:Nunito,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px">`,
    p(`Hi ${escape(opts.firstName?.trim() || "there")},`),
    p(`${escape(salon)} has let us know they can't take <strong>${escape(pet)}</strong>'s request${services ? ` for ${escape(services)}` : ""}${at ? ` on ${escape(at)}` : ""}.`),
    reason ? p(`Their message: &ldquo;${escape(reason)}&rdquo;`) : "",
    d.refund ? p("You've been refunded in full, including the service fee. Refunds usually reach your card within 5 to 10 business days.") : "",
    p("You can ask for another time or try a different salon."),
    `<p style="margin:0 0 24px"><a href="${escape(link)}" style="display:inline-block;padding:12px 24px;border-radius:999px;background:#6a45dd;color:#ffffff;font-weight:700;text-decoration:none">See your request</a></p>`,
    p("The Lyra Pet team"),
    `</div>`,
  ].join("");
  return { subject, text, html };
}
