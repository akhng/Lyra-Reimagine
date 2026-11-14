/**
 * Business slugs appear in booking links (/book/<slug>) and app URLs
 * (/b/<slug>). Lowercase letters, digits and single hyphens, 3–40 chars,
 * not a reserved word. The database enforces the same pattern.
 */
export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){2,39}$/;

export const RESERVED_SLUGS = new Set(["admin", "api", "app", "auth", "b", "book", "billing", "dashboard", "help", "login", "logout", "onboarding", "settings", "signup", "support", "www", "lyra", "pet", "platform"]);

/** A suggested slug from a business name ("Paws & Claws Grooming!" → "paws-claws-grooming"). */
export function slugify(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}

export function slugProblem(slug: string): "format" | "reserved" | null {
  if (!SLUG_PATTERN.test(slug)) return "format";
  if (RESERVED_SLUGS.has(slug)) return "reserved";
  return null;
}
