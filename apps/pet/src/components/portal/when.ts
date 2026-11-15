import type { MyRequest } from "@/features/portal/queries";
import { PART_LABEL } from "@/features/portal/schemas";

/** How a request's timing reads to a pet owner, in the salon's time zone. */
export function requestWhen(r: Pick<MyRequest, "appointmentStart" | "preferredStart" | "windows" | "timezone">): string {
  const fmt = (iso: string) => new Intl.DateTimeFormat("en-AU", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: r.timezone }).format(new Date(iso));
  if (r.appointmentStart) return fmt(r.appointmentStart);
  if (r.preferredStart) return `Asked for ${fmt(r.preferredStart)}`;
  return `Flexible: ${r.windows.map((w) => `${new Intl.DateTimeFormat("en-AU", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${w.date}T00:00:00Z`))} (${PART_LABEL[w.part].toLowerCase()})`).join(", ")}`;
}
