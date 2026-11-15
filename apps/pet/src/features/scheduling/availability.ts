import { addDays, fromLocal, hhmmToMinutes, isoWeekday, toLocal } from "./time";

/**
 * Free start times (display only; the database re-checks every booking).
 * A start is offered when, on that local day, the whole block (services +
 * clean-up buffer) fits inside the location's opening hours and a groomer's
 * hours, doesn't touch the groomer's other appointments or time off, isn't
 * on a closure, and respects minimum notice and how far ahead bookings go.
 */
export type Hours = { weekday: number; opens: string; closes: string };
export type StaffHours = { memberId: string; locationId: string; weekday: number; starts: string; ends: string };
export type Busy = { memberId: string; startsAt: string; endsAt: string };
export type Closure = { locationId: string | null; startsOn: string; endsOn: string };
export type Policy = { minNoticeMinutes: number; maxDaysAhead: number; slotStepMinutes: number };

export type AvailabilityInput = {
  timeZone: string;
  locationId: string;
  locationHours: Hours[];
  staffHours: StaffHours[];
  busy: Busy[];
  closures: Closure[];
  policy: Policy;
  /** Minutes of service, and the extra clean-up buffer after it. */
  durationMinutes: number;
  bufferMinutes: number;
  /** Restrict to one groomer, or null for anyone. */
  groomerId: string | null;
  from: string;
  to: string;
  now: Date;
};

export type Slot = { startsAt: string; localMinutes: number; groomerIds: string[] };
export type DaySlots = { date: string; slots: Slot[] };

type Window = [number, number];

function intersect(a: Window[], b: Window[]): Window[] {
  const out: Window[] = [];
  for (const [s1, e1] of a) for (const [s2, e2] of b) {
    const s = Math.max(s1, s2);
    const e = Math.min(e1, e2);
    if (e > s) out.push([s, e]);
  }
  return out;
}

export function availability(input: AvailabilityInput): DaySlots[] {
  const { timeZone: tz, policy } = input;
  const block = input.durationMinutes + input.bufferMinutes;
  const earliest = input.now.getTime() + policy.minNoticeMinutes * 60_000;
  const latest = input.now.getTime() + policy.maxDaysAhead * 86_400_000;
  const busyBy = new Map<string, Array<[number, number]>>();
  for (const b of input.busy) {
    const list = busyBy.get(b.memberId) ?? [];
    list.push([Date.parse(b.startsAt), Date.parse(b.endsAt)]);
    busyBy.set(b.memberId, list);
  }
  const members = [...new Set(input.staffHours.filter((h) => h.locationId === input.locationId && (!input.groomerId || h.memberId === input.groomerId)).map((h) => h.memberId))];
  const days: DaySlots[] = [];
  for (let date = input.from; date <= input.to; date = addDays(date, 1)) {
    if (input.closures.some((c) => (c.locationId === null || c.locationId === input.locationId) && date >= c.startsOn && date <= c.endsOn)) {
      days.push({ date, slots: [] });
      continue;
    }
    const wd = isoWeekday(date);
    const open: Window[] = input.locationHours.filter((h) => h.weekday === wd).map((h) => [hhmmToMinutes(h.opens), hhmmToMinutes(h.closes)]);
    const byStart = new Map<number, Slot>();
    for (const m of members) {
      const staff: Window[] = input.staffHours.filter((h) => h.memberId === m && h.locationId === input.locationId && h.weekday === wd).map((h) => [hhmmToMinutes(h.starts), hhmmToMinutes(h.ends)]);
      for (const [ws, we] of intersect(open, staff)) {
        // Steps are aligned to the window start, e.g. 08:00, 08:15, …
        for (let start = ws; start + block <= we; start += policy.slotStepMinutes) {
          const s = fromLocal(date, start, tz);
          const e = s + block * 60_000;
          // A spring-forward gap can shift the instant: keep only starts that are still that local time.
          if (toLocal(s, tz).minutes !== start || s < earliest || s > latest) continue;
          if ((busyBy.get(m) ?? []).some(([bs, be]) => bs < e && be > s)) continue;
          const slot = byStart.get(start) ?? { startsAt: new Date(s).toISOString(), localMinutes: start, groomerIds: [] };
          slot.groomerIds.push(m);
          byStart.set(start, slot);
        }
      }
    }
    days.push({ date, slots: [...byStart.values()].sort((a, b) => a.localMinutes - b.localMinutes) });
  }
  return days;
}

/** Total minutes and the longest buffer of a set of services (the block is duration + buffer). */
export function blockFor(services: Array<{ durationMinutes: number; bufferMinutes: number }>): { durationMinutes: number; bufferMinutes: number } {
  return { durationMinutes: services.reduce((n, s) => n + s.durationMinutes, 0), bufferMinutes: services.reduce((n, s) => Math.max(n, s.bufferMinutes), 0) };
}
