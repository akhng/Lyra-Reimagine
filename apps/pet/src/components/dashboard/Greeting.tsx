import { Mascot, MASCOTS, type MascotName } from "@/components/mascots/Mascot";

const ROTA: MascotName[] = ["coco", "mochi", "biscuit", "luna"];

function partOfDay(tz: string, now: Date): string {
  const hour = Number(new Intl.DateTimeFormat("en-AU", { hour: "numeric", hourCycle: "h23", timeZone: tz }).format(now));
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

/** "Good morning, Sudsy Paws!" with today's mascot and a message from real numbers. */
export function Greeting({ businessName, tz, visitsToday, toConfirm, now = new Date() }: { businessName: string; tz: string; visitsToday: number; toConfirm: number; now?: Date }) {
  const dayIndex = Math.floor(now.getTime() / 86_400_000);
  const mascot = ROTA[dayIndex % ROTA.length] ?? "coco";
  const who = MASCOTS[mascot].name;
  const message =
    visitsToday > 0
      ? `${who} says you have ${visitsToday} furry ${visitsToday === 1 ? "friend" : "friends"} visiting today!`
      : toConfirm > 0
        ? `${who} spotted ${toConfirm} ${toConfirm === 1 ? "request" : "requests"} waiting for your OK.`
        : `${who} says it's a calm one today. Perfect for planning ahead.`;
  const date = new Intl.DateTimeFormat("en-AU", { weekday: "long", day: "numeric", month: "long", timeZone: tz }).format(now);
  return (
    <section aria-labelledby="greeting" className="relative overflow-hidden rounded-[32px] bg-glow p-6 sm:p-8">
      <div className="relative z-10 max-w-xl">
        <p className="text-sm font-semibold text-muted">{date}</p>
        <h1 id="greeting" className="mt-1 font-display text-3xl leading-tight font-bold text-ink sm:text-4xl">
          {partOfDay(tz, now)}, {businessName}!
        </h1>
        <p className="mt-2 text-lg font-semibold text-ink/80">{message}</p>
      </div>
      <Mascot name={mascot} mood={visitsToday > 0 ? "excited" : "happy"} pose="wave" className="absolute -right-2 -bottom-6 hidden w-44 sm:block" />
    </section>
  );
}
