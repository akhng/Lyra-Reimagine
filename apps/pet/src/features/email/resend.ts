import "server-only";
import type { EmailProvider } from "./provider";

/**
 * Resend (https://resend.com), called over its REST API so there's no extra
 * dependency. EMAIL_FROM must be on a domain verified in Resend. The
 * Idempotency-Key makes a retried send of the same outbox row a no-op.
 */
export function resendProvider(apiKey: string, fetchImpl: typeof fetch = fetch): EmailProvider {
  return {
    async send({ from, to, subject, text, html, idempotencyKey }) {
      const res = await fetchImpl("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json", "idempotency-key": idempotencyKey },
        body: JSON.stringify({ from, to: [to], subject, text, html }),
      });
      // Status only: Resend's error body can echo the recipient address, which must not reach the logs.
      if (!res.ok) throw new Error(`resend send failed: ${res.status}`);
    },
  };
}
