import "server-only";

/**
 * The email provider seen by the rest of the app. Only a provider file talks
 * to an email service; adding Resend, Postmark or similar later means one new
 * file implementing this, plus a value for EMAIL_PROVIDER.
 */
export type EmailMessage = { to: string; subject: string; text: string; html: string };

export interface EmailProvider {
  send(message: EmailMessage & { from: string }): Promise<void>;
}
