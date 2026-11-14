/** Typed application error: a stable code, a user-facing message key, and the cause for logs. */
export type ErrorCode = "unauthenticated" | "forbidden" | "not_found" | "invalid_input" | "conflict" | "limit_reached" | "internal";

export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly userMessage: string,
    options?: { cause?: unknown },
  ) {
    super(userMessage, options);
    this.name = "AppError";
  }
}

export const isAppError = (e: unknown): e is AppError => e instanceof AppError;

/** Server actions return this instead of throwing across the boundary for expected failures. */
export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: { code: ErrorCode; message: string; fields?: Record<string, string> } };

export const ok = <T>(data: T): ActionResult<T> => ({ ok: true, data });
export const fail = (code: ErrorCode, message: string, fields?: Record<string, string>): ActionResult<never> => ({ ok: false, error: { code, message, ...(fields ? { fields } : {}) } });
