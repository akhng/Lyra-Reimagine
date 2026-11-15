"use client";
import { useActionState } from "react";
import { Button } from "@lyra/ui";
import { FormStatus } from "@/components/FormBits";
import { saveMyHoursAction } from "@/features/shifts/actions";
import { WEEKDAY_LABEL } from "@/features/scheduling/schemas";

/** A groomer's own weekly hours (when the business allows groomers to set them). */
export function MyHoursForm({ slug, locationId, hours }: { slug: string; locationId: string; hours: Array<{ weekday: number; starts: string; ends: string }> }) {
  const [state, action, pending] = useActionState(saveMyHoursAction.bind(null, slug, locationId), undefined);
  return (
    <form action={action} className="flex flex-col gap-3">
      <FormStatus state={state} saved="Your hours are saved." />
      <ul className="flex flex-col gap-2">
        {[1, 2, 3, 4, 5, 6, 7].map((d) => {
          const h = hours.find((x) => x.weekday === d);
          return (
            <li key={d} className="flex flex-wrap items-center gap-3">
              <label className="flex w-36 items-center gap-2 text-sm font-semibold text-ink">
                <input type="checkbox" name={`on-${d}`} defaultChecked={!!h} className="size-5 accent-[var(--primary)]" /> {WEEKDAY_LABEL[d]}
              </label>
              <input type="time" name={`starts-${d}`} defaultValue={h?.starts ?? "09:00"} aria-label={`${WEEKDAY_LABEL[d]} start`} className="h-11 rounded-[var(--radius-control)] border-2 border-border bg-surface px-3 text-sm" />
              <span aria-hidden>–</span>
              <input type="time" name={`ends-${d}`} defaultValue={h?.ends ?? "17:00"} aria-label={`${WEEKDAY_LABEL[d]} finish`} className="h-11 rounded-[var(--radius-control)] border-2 border-border bg-surface px-3 text-sm" />
            </li>
          );
        })}
      </ul>
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Saving…" : "Save my hours"}
      </Button>
    </form>
  );
}
