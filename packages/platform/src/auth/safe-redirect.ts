/** Only same-site, absolute paths are allowed as post-login destinations (no //host or schemes). */
export function safeNextPath(next: string | null | undefined, fallback = "/home"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  try {
    const url = new URL(next, "http://x");
    return url.origin === "http://x" ? `${url.pathname}${url.search}` : fallback;
  } catch {
    return fallback;
  }
}
