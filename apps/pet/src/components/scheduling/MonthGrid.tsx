import Link from "next/link";
import { cn } from "@lyra/ui";
import type { AppointmentStatus } from "@/features/scheduling/schemas";
import { STATUS_LABEL } from "@/features/scheduling/schemas";

/** Status colours for the month view (tokens via classes; a text label is always present). */
const DOT: Record<AppointmentStatus, string> = { booked: "bg-sky", confirmed: "bg-primary", checked_in: "bg-butter", in_progress: "bg-coral", completed: "bg-mint", cancelled: "bg-border", no_show: "bg-danger" };
export type MonthItem = { id: string; date: string; time: string; petName: string; groomer: string; status: AppointmentStatus };

/** Month view: each day shows how busy it is and the first few pets; a day opens its day view. */
export function MonthGrid({ days, month, today, items, dayHref }: { days: string[]; month: string; today: string; items: MonthItem[]; dayHref: (date: string) => string }) {
  const byDay = new Map<string, MonthItem[]>();
  for (const i of items) byDay.set(i.date, [...(byDay.get(i.date) ?? []), i]);
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-7 gap-1.5 text-center text-xs font-bold text-muted sm:gap-2" aria-hidden>
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <ol className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {days.map((d) => {
          const list = (byDay.get(d) ?? []).sort((a, b) => a.time.localeCompare(b.time));
          const active = list.filter((x) => x.status !== "cancelled");
          const inMonth = d.startsWith(month);
          const label = new Intl.DateTimeFormat("en-AU", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));
          return (
            <li key={d} className="min-w-0">
              <Link
                href={dayHref(d)}
                aria-label={`${label}: ${active.length} appointment${active.length === 1 ? "" : "s"}`}
                className={cn("lift flex h-full min-h-16 flex-col gap-1 rounded-2xl border p-1.5 text-left sm:min-h-28 sm:p-2", inMonth ? "border-border bg-surface" : "border-transparent bg-surface-2/60 text-muted", d === today && "ring-2 ring-primary")}
              >
                <span className={cn("text-sm font-bold tabular", d === today ? "text-primary-text" : "text-ink")}>{Number(d.slice(8))}</span>
                {active.length ? <span className="text-[11px] font-semibold text-ink sm:hidden">{active.length}</span> : null}
                <ul className="hidden flex-col gap-0.5 sm:flex">
                  {list.slice(0, 3).map((x) => (
                    <li key={x.id} className="flex min-w-0 items-center gap-1 text-[11px] text-ink">
                      <span className={cn("size-2 shrink-0 rounded-full", DOT[x.status])} aria-hidden />
                      <span className="truncate">
                        {x.time} {x.petName}
                        <span className="sr-only">, {STATUS_LABEL[x.status]}, with {x.groomer}</span>
                      </span>
                    </li>
                  ))}
                  {list.length > 3 ? <li className="text-[11px] font-semibold text-muted">+{list.length - 3} more</li> : null}
                </ul>
              </Link>
            </li>
          );
        })}
      </ol>
      <ul className="flex flex-wrap gap-3 text-xs text-muted" aria-label="Status colours">
        {(["booked", "confirmed", "in_progress", "completed", "cancelled"] as const).map((s) => (
          <li key={s} className="inline-flex items-center gap-1">
            <span className={cn("size-2.5 rounded-full", DOT[s])} aria-hidden /> {STATUS_LABEL[s]}
          </li>
        ))}
      </ul>
    </div>
  );
}
