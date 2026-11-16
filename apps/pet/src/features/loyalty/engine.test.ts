import { describe, expect, it } from "vitest";
import { awardLabel, groomStreak, levelFor, pointsFor } from "./engine";

describe("levels", () => {
  it("climbs with lifetime points and shows progress to the next level", () => {
    expect(levelFor(0)).toMatchObject({ name: "Puppy Pal", index: 0, progress: 0 });
    expect(levelFor(150)).toMatchObject({ name: "Fresh & Fluffy", next: { name: "Pampered Pet", min: 300 } });
    expect(levelFor(150).progress).toBeCloseTo(0.25);
    expect(levelFor(5000)).toMatchObject({ name: "Grooming Legend", next: null, progress: 1 });
    expect(levelFor(-20).name).toBe("Puppy Pal");
  });
});

describe("grooming streaks", () => {
  it("counts grooms within the interval and never punishes a gap", () => {
    expect(groomStreak([], 6, "2026-11-16")).toEqual({ current: 0, best: 0, active: false });
    expect(groomStreak(["2026-08-01", "2026-09-10", "2026-10-20"], 6, "2026-11-16")).toEqual({ current: 3, best: 3, active: true });
    expect(groomStreak(["2026-01-01", "2026-02-10", "2026-09-01", "2026-10-01"], 6, "2026-11-16")).toEqual({ current: 2, best: 2, active: true });
    expect(groomStreak(["2026-01-01", "2026-02-01", "2026-03-01"], 6, "2026-11-16")).toEqual({ current: 0, best: 3, active: false });
  });
});

describe("badges and points", () => {
  it("names awards and points like the brief", () => {
    expect(awardLabel("grooms_5", "Mochi").body).toBe("Congratulations! Mochi has completed 5 grooming sessions!");
    expect(awardLabel("grooms_1", "Mochi").title).toBe("First groom!");
    expect(awardLabel("five_star").title).toBe("Five-Star Grooming Champion");
    expect(pointsFor(9500, 10, 1)).toBe(105);
    expect(pointsFor(null, 10, 1)).toBe(10);
  });
});
