import { describe, expect, it } from "vitest";
import { availability, blockFor, type AvailabilityInput } from "./availability";
import { addDays, fromLocal, isoWeekday, toLocal } from "./time";

const TZ = "Australia/Melbourne";
const L = "loc";
const base = (over: Partial<AvailabilityInput> = {}): AvailabilityInput => ({
  timeZone: TZ,
  locationId: L,
  locationHours: [1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, opens: "08:00", closes: "17:00" })),
  staffHours: [1, 2, 3, 4, 5].map((weekday) => ({ memberId: "ann", locationId: L, weekday, starts: "09:00", ends: "12:00" })),
  busy: [],
  closures: [],
  policy: { minNoticeMinutes: 60, maxDaysAhead: 60, slotStepMinutes: 30 },
  durationMinutes: 60,
  bufferMinutes: 0,
  groomerId: null,
  from: "2026-11-23",
  to: "2026-11-23",
  now: new Date("2026-11-15T00:00:00Z"),
  ...over,
});
const times = (d: ReturnType<typeof availability>) => d.flatMap((x) => x.slots.map((s) => `${x.date} ${String(Math.floor(s.localMinutes / 60)).padStart(2, "0")}:${String(s.localMinutes % 60).padStart(2, "0")}`));

describe("time helpers", () => {
  it("converts local wall-clock times across daylight saving", () => {
    // AEDT (UTC+11) in November, AEST (UTC+10) in June.
    expect(new Date(fromLocal("2026-11-23", 9 * 60, TZ)).toISOString()).toBe("2026-11-22T22:00:00.000Z");
    expect(new Date(fromLocal("2026-06-22", 9 * 60, TZ)).toISOString()).toBe("2026-06-21T23:00:00.000Z");
    expect(toLocal(Date.parse("2026-11-22T22:00:00Z"), TZ)).toEqual({ date: "2026-11-23", minutes: 540 });
    expect(isoWeekday("2026-11-23")).toBe(1);
    expect(isoWeekday("2026-11-29")).toBe(7);
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("availability", () => {
  it("offers starts where opening hours and staff hours overlap, in slot steps, with the whole block fitting", () => {
    expect(times(availability(base()))).toEqual(["2026-11-23 09:00", "2026-11-23 09:30", "2026-11-23 10:00", "2026-11-23 10:30", "2026-11-23 11:00"]);
    expect(times(availability(base({ bufferMinutes: 30 })))).toEqual(["2026-11-23 09:00", "2026-11-23 09:30", "2026-11-23 10:00", "2026-11-23 10:30"]);
  });
  it("skips times that touch existing appointments or time off (including their buffer)", () => {
    const busy = [{ memberId: "ann", startsAt: new Date(fromLocal("2026-11-23", 600, TZ)).toISOString(), endsAt: new Date(fromLocal("2026-11-23", 645, TZ)).toISOString() }];
    // 09:00–10:00 ends exactly as the busy block starts, so it is free.
    expect(times(availability(base({ busy })))).toEqual(["2026-11-23 09:00", "2026-11-23 11:00"]);
  });
  it("merges groomers and can restrict to one", () => {
    const staffHours = [...base().staffHours, { memberId: "bo", locationId: L, weekday: 1, starts: "14:00", ends: "16:00" }];
    const all = availability(base({ staffHours }));
    expect(all[0]?.slots.find((s) => s.localMinutes === 14 * 60)?.groomerIds).toEqual(["bo"]);
    expect(times(availability(base({ staffHours, groomerId: "bo" })))).toEqual(["2026-11-23 14:00", "2026-11-23 14:30", "2026-11-23 15:00"]);
  });
  it("respects closures, days off, minimum notice and how far ahead", () => {
    expect(times(availability(base({ closures: [{ locationId: null, startsOn: "2026-11-23", endsOn: "2026-11-23" }] })))).toEqual([]);
    expect(times(availability(base({ from: "2026-11-28", to: "2026-11-29" })))).toEqual([]);
    const now = new Date(fromLocal("2026-11-23", 9 * 60 + 20, TZ));
    expect(times(availability(base({ now })))).toEqual(["2026-11-23 10:30", "2026-11-23 11:00"]);
    expect(times(availability(base({ policy: { minNoticeMinutes: 0, maxDaysAhead: 3, slotStepMinutes: 30 } })))).toEqual([]);
  });
  it("handles the day daylight saving starts (no 02:00–03:00 local)", () => {
    // DST starts Sunday 4 Oct 2026 in Melbourne; a Sunday salon open 01:00–05:00.
    const day = "2026-10-04";
    const r = availability(base({ from: day, to: day, locationHours: [{ weekday: 7, opens: "01:00", closes: "05:00" }], staffHours: [{ memberId: "ann", locationId: L, weekday: 7, starts: "01:00", ends: "05:00" }], durationMinutes: 30, now: new Date("2026-09-01T00:00:00Z") }));
    const t = times(r);
    expect(t).not.toContain(`${day} 02:00`);
    expect(t).toContain(`${day} 03:00`);
    // The 01:30 slot ends at 03:00 local, 30 real minutes later.
    expect(r[0]?.slots.find((s) => s.localMinutes === 90)?.startsAt).toBe("2026-10-03T15:30:00.000Z");
  });
  it("sums service time and keeps the longest buffer", () => {
    expect(blockFor([{ durationMinutes: 60, bufferMinutes: 15 }, { durationMinutes: 15, bufferMinutes: 5 }])).toEqual({ durationMinutes: 75, bufferMinutes: 15 });
  });
});
