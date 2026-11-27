import { redirect } from "next/navigation";

/**
 * Payments moved out of Settings to its own page (Manage Payments). Kept as a
 * redirect because Stripe onboarding links issued before the move return
 * here (?returned=1 / ?refresh=1), as do old bookmarks; the query is kept.
 */
export default async function OldPaymentsSettings({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const q = new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : [])));
  redirect(`/b/${encodeURIComponent(slug)}/payments${q.size ? `?${q.toString()}` : ""}`);
}
