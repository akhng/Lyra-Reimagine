/** Shared form helpers for server actions. */
export type FormState = { ok?: boolean; error?: string; fields?: Record<string, string>; id?: string } | undefined;

export const fieldErrors = (issues: Array<{ path: PropertyKey[]; message: string }>) => Object.fromEntries(issues.map((i) => [String(i.path[0]), i.message]));

/** Text from a form field: trimmed, "" when missing. */
export const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

/** Empty string → null, for optional columns. */
export const orNull = (v: string) => (v === "" ? null : v);
