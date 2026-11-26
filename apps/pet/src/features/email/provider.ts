import "server-only";

/**
 * The email provider seen by the rest of the app. Only a provider file talks
 * to an email service (resend.ts; fake.ts for tests); switching service means
 * one new file implementing this, plus a value for EMAIL_PROVIDER.
 */
export type EmailMessage = { to: string; subject: string; text: string; html: string };

export interface EmailProvider {
  /** `idempotencyKey` is the same on every retry of one email, so a provider that supports it never delivers twice. */
  send(message: EmailMessage & { from: string; idempotencyKey: string }): Promise<void>;
}
