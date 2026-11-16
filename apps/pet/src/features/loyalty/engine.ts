/**
 * Gamification maths shown to people (ADR 0003). Points and awards are
 * recorded by the database; these pure functions turn them into levels,
 * streaks and readable badges, so the rules are unit-tested.
 */
export const LEVELS = [
  { name: "Puppy Pal", min: 0 },
  { name: "Fresh & Fluffy", min: 100 },
  { name: "Pampered Pet", min: 300 },
  { name: "Pawsome Regular", min: 700 },
  { name: "Grooming Legend", min: 1500 },
] as const;

export type Level = { name: string; index: number; min: number; next: { name: string; min: number } | null; progress: number };

/** Level from lifetime points earned (redemptions never lower a level). */
export function levelFor(lifetime: number): Level {
  const pts = Math.max(0, lifetime);
  let index = 0;
  for (let i = 0; i < LEVELS.length; i++) if (pts >= (LEVELS[i]?.min ?? 0)) index = i;
  const cur = LEVELS[index] ?? LEVELS[0];
  const next = LEVELS[index + 1] ?? null;
  return { name: cur.name, index, min: cur.min, next: next ? { name: next.name, min: next.min } : null, progress: next ? (pts - cur.min) / (next.min - cur.min) : 1 };
}

/**
 * Grooming streak: consecutive grooms each within the pet's groom interval
 * (+2 weeks' grace) of the previous one. It never punishes: a long gap just
 * starts a new streak, and the best streak is kept.
 */
export function groomStreak(dates: string[], intervalWeeks: number | null, today: string): { current: number; best: number; active: boolean } {
  const days = [...new Set(dates)].sort();
  if (!days.length) return { current: 0, best: 0, active: false };
  const limit = ((intervalWeeks ?? 6) + 2) * 7;
  const gap = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
  let run = 1;
  let best = 1;
  for (let i = 1; i < days.length; i++) {
    run = gap(days[i - 1] as string, days[i] as string) <= limit ? run + 1 : 1;
    best = Math.max(best, run);
  }
  const active = gap(days.at(-1) as string, today) <= limit;
  return { current: active ? run : 0, best, active };
}

/** Badge wording for awards the database records. */
export function awardLabel(key: string, petName?: string): { title: string; body: string } {
  const pet = petName ?? "Your pet";
  const grooms = /^grooms_(\d+)$/.exec(key);
  if (grooms) {
    const n = Number(grooms[1]);
    return n === 1 ? { title: "First groom!", body: `${pet} completed their first grooming session.` } : { title: `${n} grooms`, body: `Congratulations! ${pet} has completed ${n} grooming sessions!` };
  }
  const business: Record<string, string> = {
    first_10: "First 10 Grooming Appointments", completed_100: "100 Completed Appointments", happy_pets_50: "50 Happy Pets", loyalty_hero: "Customer Loyalty Hero",
    online_star: "Online Booking Star", history_keeper: "History Keeper", five_star: "Five-Star Grooming Champion",
  };
  return { title: business[key] ?? "Achievement unlocked", body: business[key] ? "Unlocked from your real records." : "" };
}

/** Points an appointment would earn (mirrors the database rule), for showing rules to customers. */
export function pointsFor(priceCents: number | null, perAppointment: number, perDollar: number): number {
  return perAppointment + Math.floor(((priceCents ?? 0) / 100) * perDollar);
}
