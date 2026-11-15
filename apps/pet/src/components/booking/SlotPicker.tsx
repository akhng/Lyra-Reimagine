"use client";
import { cn } from "@lyra/ui";
import type { DaySlots } from "@/features/scheduling/availability";
import { minutesToHhmm } from "@/features/scheduling/time";

const dayLabel = (d: string) => new Intl.DateTimeFormat("en-AU", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));

/** Days with free times, then the times of the chosen day. Buttons with aria-pressed; keyboard friendly. */
export function SlotPicker({ days, date, startsAt, onDate, onTime }: { days: DaySlots[]; date: string | null; startsAt: string | null; onDate: (d: string) => void; onTime: (iso: string, groomerIds: string[]) => void }) {
  const open = days.filter((d) => d.slots.length);
  const chosen = open.find((d) => d.date === date) ?? open[0];
  if (!open.length) return <p className="rounded-[var(--radius-control)] bg-surface-2 px-4 py-3 text-sm text-muted">No times are free in the next few weeks for these choices. Try fewer services, another groomer, or contact the salon.</p>;
  return (
    <div className="flex flex-col gap-4">
      <div role="group" aria-label="Day" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {open.map((d) => (
          <button key={d.date} type="button" onClick={() => onDate(d.date)} aria-pressed={chosen?.date === d.date} className={cn("flex min-h-14 min-w-20 shrink-0 flex-col items-center justify-center rounded-[var(--radius-control)] border px-3 text-sm", chosen?.date === d.date ? "border-primary bg-primary text-primary-contrast" : "border-border bg-surface hover:bg-surface-2")}>
            <span className="font-semibold">{dayLabel(d.date)}</span>
            <span className={cn("text-xs", chosen?.date === d.date ? "text-primary-contrast/90" : "text-muted")}>{d.slots.length} free</span>
          </button>
        ))}
      </div>
      {chosen ? (
        <div role="group" aria-label={`Times on ${dayLabel(chosen.date)}`} className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">
          {chosen.slots.map((s) => (
            <button key={s.startsAt} type="button" onClick={() => onTime(s.startsAt, s.groomerIds)} aria-pressed={startsAt === s.startsAt} className={cn("min-h-11 rounded-[var(--radius-control)] border text-sm tabular", startsAt === s.startsAt ? "border-primary bg-primary text-primary-contrast" : "border-border bg-surface hover:bg-surface-2")}>
              {minutesToHhmm(s.localMinutes)}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
