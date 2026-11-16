import { describe, expect, it } from "vitest";
import { achievementProgress, sortAchievements } from "./achievements";

describe("business achievements", () => {
  it("measures progress from counts and caps it at the target", () => {
    const p = achievementProgress({ completed: 12, happyPets: 5, loyalCustomers: 0, onlineBookings: 30, groomRecords: 2, fiveStarReviews: 0 });
    const first = p.find((a) => a.key === "first_10");
    expect(first).toMatchObject({ done: true, value: 10, ratio: 1 });
    expect(p.find((a) => a.key === "completed_100")).toMatchObject({ done: false, value: 12, ratio: 0.12 });
    expect(p.find((a) => a.key === "loyalty_hero")?.ratio).toBe(0);
  });

  it("lists unlocked achievements first, then the closest", () => {
    const sorted = sortAchievements(achievementProgress({ completed: 12, happyPets: 40, loyalCustomers: 0, onlineBookings: 30, groomRecords: 2, fiveStarReviews: 0 }));
    expect(sorted.slice(0, 2).every((a) => a.done)).toBe(true);
    expect(sorted[2]?.key).toBe("happy_pets_50");
  });
});
