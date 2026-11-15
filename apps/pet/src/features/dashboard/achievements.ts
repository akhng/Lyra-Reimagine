/**
 * Business achievements (ADR 0003): goals measured from real records, shown
 * with progress. Pure catalogue + progress maths; the counts come from
 * queries. Persistent awards and celebrations arrive with the gamification
 * engine (transformation R5).
 */
export type BusinessMetrics = { completed: number; happyPets: number; loyalCustomers: number; onlineBookings: number; groomRecords: number };

export type Achievement = { key: string; title: string; description: string; metric: keyof BusinessMetrics; target: number; mascot: "coco" | "mochi" | "biscuit" | "luna" };

export const BUSINESS_ACHIEVEMENTS: Achievement[] = [
  { key: "first_10", title: "First 10 Grooming Appointments", description: "Complete ten appointments.", metric: "completed", target: 10, mascot: "coco" },
  { key: "happy_pets_50", title: "50 Happy Pets", description: "Groom fifty different pets.", metric: "happyPets", target: 50, mascot: "mochi" },
  { key: "completed_100", title: "100 Completed Appointments", description: "A hundred appointments, start to finish.", metric: "completed", target: 100, mascot: "biscuit" },
  { key: "loyalty_hero", title: "Customer Loyalty Hero", description: "Ten customers who have visited three or more times.", metric: "loyalCustomers", target: 10, mascot: "luna" },
  { key: "online_star", title: "Online Booking Star", description: "Twenty-five bookings made online.", metric: "onlineBookings", target: 25, mascot: "coco" },
  { key: "history_keeper", title: "History Keeper", description: "Record twenty-five grooms with notes or photos.", metric: "groomRecords", target: 25, mascot: "mochi" },
];

export type AchievementProgress = Achievement & { value: number; done: boolean; ratio: number };

export function achievementProgress(m: BusinessMetrics): AchievementProgress[] {
  return BUSINESS_ACHIEVEMENTS.map((a) => {
    const value = Math.max(0, m[a.metric]);
    return { ...a, value: Math.min(value, a.target), done: value >= a.target, ratio: Math.min(1, value / a.target) };
  });
}

/** The unlocked ones first, then the closest to done. */
export function sortAchievements(list: AchievementProgress[]): AchievementProgress[] {
  return [...list].sort((a, b) => Number(b.done) - Number(a.done) || b.ratio - a.ratio);
}
