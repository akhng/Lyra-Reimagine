import "server-only";
import { serverEnv } from "@lyra/platform/env";
import { logger } from "@lyra/platform/logger";
import { createSupabaseAdminClient } from "@lyra/platform/supabase/admin";
import { fakeEmailProvider } from "./fake";
import type { EmailProvider } from "./provider";
import { renderEmail, type EmailData } from "./templates";

/** The configured email provider, or null when emails are switched off (EMAIL_PROVIDER=none). */
export function emailProvider(): EmailProvider | null {
  const env = serverEnv();
  if (env.EMAIL_PROVIDER === "fake") {
    // Test-only stand-in; never in production.
    if (process.env.VERCEL_ENV === "production") return null;
    return fakeEmailProvider(env.EMAIL_FAKE_URL);
  }
  return null;
}

/**
 * Delivers queued customer emails (email_outbox). Safe to call often and from
 * several places at once: rows are claimed with SKIP LOCKED, failures are
 * retried up to five times, and rows older than a day are skipped. Never
 * throws; logs ids and counts only, never addresses or content.
 *
 * Service role: the outbox has no user policies, and the recipient's address
 * comes from Supabase Auth for the row's own user_id (written by a trigger).
 */
export async function processEmailOutbox(limit = 20): Promise<number> {
  const provider = emailProvider();
  if (!provider) return 0;
  const env = serverEnv();
  const admin = createSupabaseAdminClient();
  const { data: rows, error } = await admin.rpc("claim_email_outbox", { p_limit: limit });
  if (error) {
    logger.warn({ code: error.code }, "email outbox claim failed");
    return 0;
  }
  let sent = 0;
  for (const row of rows ?? []) {
    try {
      const { data: u, error: userError } = await admin.auth.admin.getUserById(row.user_id);
      if (userError || !u.user?.email) throw new Error("recipient not found");
      const meta = (u.user.user_metadata ?? {}) as { full_name?: unknown };
      const firstName = typeof meta.full_name === "string" ? meta.full_name.split(" ")[0] : null;
      const email = renderEmail(row.kind, (row.data ?? {}) as EmailData, { appUrl: env.APP_URL, firstName });
      if (!email) {
        await admin.from("email_outbox").update({ status: "skipped", last_error: "no template" }).eq("id", row.id);
        continue;
      }
      await provider.send({ ...email, from: env.EMAIL_FROM, to: u.user.email });
      await admin.from("email_outbox").update({ status: "sent", sent_at: new Date().toISOString(), last_error: null }).eq("id", row.id);
      sent++;
    } catch (e) {
      const message = e instanceof Error ? e.message.slice(0, 200) : "unknown";
      // Back to pending for another try, unless this was the last allowed attempt.
      await admin.from("email_outbox").update({ status: row.attempts >= 5 ? "failed" : "pending", last_error: message }).eq("id", row.id);
      logger.warn({ emailId: row.id, kind: row.kind, attempt: row.attempts, err: message.slice(0, 80) }, "email send failed");
    }
  }
  if (sent) logger.info({ sent }, "emails sent");
  return sent;
}
