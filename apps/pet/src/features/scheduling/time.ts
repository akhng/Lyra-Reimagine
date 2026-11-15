/**
 * Wall-clock time in a named zone, without dependencies. All scheduling code
 * goes through these helpers so daylight-saving changes are handled once.
 */
const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmt(tz: string): Intl.DateTimeFormat {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
    fmtCache.set(tz, f);
  }
  return f;
}

export type Local = { date: string; minutes: number };

/** The local date (YYYY-MM-DD) and minutes after midnight of an instant. */
export function toLocal(ms: number, tz: string): Local {
  const p = Object.fromEntries(fmt(tz).formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute) };
}

/** The instant for a local date and minutes after midnight. In a spring-forward gap it moves forward; in a fall-back overlap it picks the first. */
export function fromLocal(date: string, minutes: number, tz: string): number {
  const naive = Date.parse(`${date}T00:00:00Z`) + minutes * 60_000;
  let t = naive;
  for (let i = 0; i < 3; i++) {
    const l = toLocal(t, tz);
    const diff = Date.parse(`${l.date}T00:00:00Z`) + l.minutes * 60_000 - naive;
    if (diff === 0) return t;
    t -= diff;
  }
  return t;
}

export const hhmmToMinutes = (s: string) => {
  const [h, m] = s.split(":").map(Number) as [number, number];
  return h * 60 + m;
};
export const minutesToHhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export function addDays(date: string, n: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}
/** ISO weekday: 1 = Monday … 7 = Sunday. */
export function isoWeekday(date: string): number {
  const d = new Date(`${date}T00:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}
export function localToday(tz: string, now: Date = new Date()): string {
  return toLocal(now.getTime(), tz).date;
}

/** An ISO timestamp `days` from now (negative for the past). */
export function isoFromNow(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}
