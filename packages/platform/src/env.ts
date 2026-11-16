import { z } from "zod";

/**
 * Environment validation, parsed lazily on first use so tooling that imports
 * modules without a full environment (type generation, unit tests) works,
 * while the first real request fails fast with a readable error.
 * Only NEXT_PUBLIC_* values may reach the browser.
 */
const optional = z
  .string()
  .optional()
  .transform((v) => (v === "" ? undefined : v));

/** Values pasted into hosting dashboards often carry spaces, newlines or quotes. */
const cleaned = z.string().transform((v) => v.trim().replace(/^["']|["']$/g, "").trim());
const key = cleaned.pipe(z.string().min(20));

const supabaseUrl = cleaned.transform((v) => v.replace(/\/+$/, "")).pipe(z.string()).superRefine((value, ctx) => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    ctx.addIssue({ code: "custom", message: `is not a valid URL ("${value}")` });
    return;
  }
  if (url.pathname !== "/") ctx.addIssue({ code: "custom", message: `must be only the project address (${url.origin})` });
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !local) ctx.addIssue({ code: "custom", message: "must start with https://" });
});

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: key,
});

/** Exported for tests. */
export const serverSchema = clientSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: key,
  // No trailing slash, so links like `${APP_URL}/auth/callback` never get "//".
  APP_URL: cleaned.pipe(z.url()).transform((v) => v.replace(/\/+$/, "")).default("http://localhost:3200"),
  ANTHROPIC_API_KEY: optional,
  LYRA_MODEL_PRIMARY: optional,
  LYRA_MODEL_FAST: optional,
  PLATFORM_ADMIN_EMAILS: z.string().default(""),
  /** Stripe Connect (ADR 0004). Missing keys ⇒ online payments are off and requests are paid at the salon. */
  STRIPE_SECRET_KEY: optional,
  STRIPE_WEBHOOK_SECRET: optional,
  /** "fake" is for automated tests only and is refused in production. */
  PAYMENTS_PROVIDER: z.enum(["stripe", "fake"]).default("stripe"),
  /** Shown on service fee tax invoices. */
  PLATFORM_LEGAL_NAME: optional,
  PLATFORM_ABN: optional,
});

export type ClientEnv = z.infer<typeof clientSchema>;
export type ServerEnv = z.infer<typeof serverSchema>;

function format(error: z.ZodError): string {
  return error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ");
}

let client: ClientEnv | undefined;
export function clientEnv(): ClientEnv {
  if (client) return client;
  // Direct references so Next.js inlines the public values into browser bundles.
  const parsed = clientSchema.safeParse({ NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY });
  if (!parsed.success) throw new Error(`Invalid public environment: ${format(parsed.error)}`);
  return (client = parsed.data);
}

let server: ServerEnv | undefined;
export function serverEnv(): ServerEnv {
  if (server) return server;
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) throw new Error(`Invalid server environment: ${format(parsed.error)}`);
  return (server = parsed.data);
}
