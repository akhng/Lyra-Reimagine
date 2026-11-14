import "server-only";
import pino from "pino";

/**
 * Structured logger. Log ids, counts and latencies — never customer names,
 * contact details, pet care notes or payment data.
 */
export const logger = pino({ level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "test" ? "silent" : "info"), base: { service: "lyra" } });
