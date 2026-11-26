import "server-only";
import type { EmailProvider } from "./provider";

/**
 * A stand-in email service for automated tests (EMAIL_PROVIDER=fake, refused
 * in production): delivers to the local stack's Mailpit through its send API,
 * so e2e tests can read the email exactly as a customer would receive it.
 */
export function fakeEmailProvider(mailpitUrl: string): EmailProvider {
  return {
    async send({ from, to, subject, text, html }) {
      const match = /^(.*)<([^>]+)>\s*$/.exec(from);
      const sender = match ? { Name: match[1]?.trim() ?? "", Email: match[2] ?? from } : { Email: from };
      const res = await fetch(`${mailpitUrl}/api/v1/send`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ From: sender, To: [{ Email: to }], Subject: subject, Text: text, HTML: html }),
      });
      if (!res.ok) throw new Error(`mailpit send failed: ${res.status}`);
    },
  };
}
