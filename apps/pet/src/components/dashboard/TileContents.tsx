import { ArrowDownRight, ArrowUpRight, Trophy } from "lucide-react";
import Link from "next/link";
import { Badge, cn } from "@lyra/ui";
import { Mascot, type MascotName, type Mood } from "@/components/mascots/Mascot";
import { STATUS_TONE } from "@/components/scheduling/status";
import { Stars } from "@/components/loyalty/Stars";
import { sortAchievements, achievementProgress } from "@/features/dashboard/achievements";
import type { DashboardData } from "@/features/dashboard/queries";
import { STATUS_LABEL } from "@/features/scheduling/schemas";
import { minutesToHhmm, toLocal } from "@/features/scheduling/time";
import { formatAud } from "@/features/services/pricing";

/** Server-rendered tile bodies: a mascot, one meaningful number, a short description and a few real rows. */
function Stat({ value, label, mascot, mood = "happy" }: { value: string | number; label: string; mascot: MascotName; mood?: Mood }) {
  return (
    <div className="flex items-end justify-between gap-3">
      <p>
        <span className="block font-display text-5xl leading-none font-bold text-ink tabular">{value}</span>
        <span className="mt-1 block text-sm font-semibold text-ink/80">{label}</span>
      </p>
      <Mascot name={mascot} mood={mood} pose="peek" className="-mr-2 -mb-1 w-24 shrink-0 transition-transform duration-300 group-hover:-rotate-3" />
    </div>
  );
}

const time = (iso: string, tz: string) => minutesToHhmm(toLocal(Date.parse(iso), tz).minutes);
const day = (iso: string, tz: string) => new Intl.DateTimeFormat("en-AU", { weekday: "short", day: "numeric", month: "short", timeZone: tz }).format(new Date(iso));

export function TodayTile({ d, slug, tz }: { d: DashboardData; slug: string; tz: string }) {
  const next = d.today.filter((a) => a.status !== "completed").slice(0, 4);
  return (
    <>
      <Stat value={d.today.length} label={d.today.length === 1 ? "furry friend visiting today" : "furry friends visiting today"} mascot="coco" mood={d.today.length ? "excited" : "sleepy"} />
      {next.length ? (
        <ol className="relative z-10 flex flex-col gap-1.5">
          {next.map((a) => (
            <li key={a.id}>
              <Link href={`/b/${slug}/appointments/${a.id}`} className="flex items-center gap-3 rounded-2xl bg-surface/80 px-3 py-2 transition-colors hover:bg-surface">
                <span className="w-12 shrink-0 font-bold text-ink tabular">{time(a.startsAt, tz)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-ink">{a.petName}</span>
                  <span className="block truncate text-xs text-muted">{[a.services.join(", "), d.teamNames[a.groomerId]].filter(Boolean).join(" · ")}</span>
                </span>
                <Badge tone={STATUS_TONE[a.status]}>{STATUS_LABEL[a.status]}</Badge>
              </Link>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-ink/80">{d.today.length ? "Everyone's done for today. Lovely work!" : "No appointments today. A good moment to tidy the calendar or plan the week."}</p>
      )}
    </>
  );
}

export function RequestsTile({ d, slug, tz }: { d: DashboardData; slug: string; tz: string }) {
  const total = d.pendingRequests.length + d.awaitingConfirmation.length;
  const rows = [
    ...d.pendingRequests.slice(0, 3).map((r) => ({ key: r.id, href: `/b/${slug}/requests`, label: r.petName, sub: "New request" })),
    ...d.awaitingConfirmation.slice(0, 3).map((a) => ({ key: a.id, href: `/b/${slug}/appointments/${a.id}`, label: a.petName, sub: `Online booking · ${day(a.startsAt, tz)}, ${time(a.startsAt, tz)}` })),
  ].slice(0, 3);
  return (
    <>
      <Stat value={total} label={total === 1 ? "request waiting for you" : "requests waiting for you"} mascot="luna" mood={total ? "curious" : "happy"} />
      {rows.length ? (
        <ul className="relative z-10 flex flex-col gap-1.5">
          {rows.map((r) => (
            <li key={r.key}>
              <Link href={r.href} className="block rounded-2xl bg-surface/80 px-3 py-2 text-sm transition-colors hover:bg-surface">
                <span className="font-semibold text-ink">{r.label}</span> <span className="text-muted">· {r.sub}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink/80">All caught up. New booking requests and online bookings that need a confirmation land here.</p>
      )}
    </>
  );
}

export function GroomersTile({ d }: { d: DashboardData }) {
  const working = d.groomers.filter((g) => g.until);
  return (
    <>
      <Stat value={`${working.length}/${d.groomers.length}`} label="groomers working now" mascot="biscuit" mood={working.length ? "happy" : "sleepy"} />
      <ul className="flex flex-wrap gap-1.5">
        {d.groomers.slice(0, 6).map((g) => (
          <li key={g.id} className={cn("rounded-full px-3 py-1 text-xs font-semibold", g.until ? "bg-surface text-ink" : "bg-surface/50 text-muted")}>
            {g.name} · {g.until ? `until ${g.until}` : g.off ? "time off" : "not rostered now"}
          </li>
        ))}
      </ul>
    </>
  );
}

export function CustomersTile({ d }: { d: DashboardData }) {
  return (
    <>
      <Stat value={d.customers.pets} label={`pets · ${d.customers.total} customers`} mascot="mochi" />
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-2xl bg-surface/80 px-3 py-2">
          <dt className="text-xs text-muted">New this month</dt>
          <dd className="font-display text-xl font-bold text-ink tabular">{d.customers.newThisMonth}</dd>
        </div>
        <div className="rounded-2xl bg-surface/80 px-3 py-2">
          <dt className="text-xs text-muted">Due for a groom</dt>
          <dd className="font-display text-xl font-bold text-ink tabular">{d.customers.due}</dd>
        </div>
      </dl>
    </>
  );
}

export function ServicesTile({ d }: { d: DashboardData }) {
  return (
    <>
      <Stat value={d.services.active} label="services on the menu" mascot="biscuit" mood="curious" />
      {d.services.top.length ? (
        <ol className="flex flex-col gap-1 text-sm">
          {d.services.top.map((s, i) => (
            <li key={s.name} className="flex items-center justify-between gap-2 rounded-2xl bg-surface/80 px-3 py-1.5">
              <span className="truncate text-ink">
                <span className="font-bold">{i + 1}.</span> {s.name}
              </span>
              <span className="shrink-0 text-xs text-muted tabular">{s.count} booked</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-ink/80">Your most-booked services from the last 30 days will show here.</p>
      )}
    </>
  );
}

export function RevenueTile({ d }: { d: DashboardData }) {
  const { thisWeekCents: now, lastWeekCents: prev } = d.revenue;
  const change = prev > 0 ? Math.round(((now - prev) / prev) * 100) : null;
  return (
    <>
      <Stat value={formatAud(now)} label="last 7 days, estimated" mascot="coco" mood={change !== null && change >= 0 ? "proud" : "happy"} />
      <p className="flex flex-wrap items-center gap-2 text-sm text-ink/80">
        {change !== null ? (
          <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-bold", change >= 0 ? "bg-mint-tint text-success" : "bg-coral-tint text-coral-text")}>
            {change >= 0 ? <ArrowUpRight className="size-4" aria-hidden /> : <ArrowDownRight className="size-4" aria-hidden />} {Math.abs(change)}% vs the week before
          </span>
        ) : null}
        <span>
          {d.revenue.completedThisWeek} completed · from appointment prices, not payments
        </span>
      </p>
    </>
  );
}

export function ReviewsTile({ d }: { d: DashboardData }) {
  const r = d.reviews;
  return (
    <>
      <Stat value={r.average !== null ? r.average.toFixed(1) : "–"} label={r.count ? `average from ${r.count} review${r.count === 1 ? "" : "s"}` : "no reviews yet"} mascot="coco" mood={r.average !== null && r.average >= 4.5 ? "proud" : "happy"} />
      {r.latest ? (
        <p className="rounded-2xl bg-surface/80 px-3 py-2 text-sm text-ink">
          <Stars rating={r.latest.rating} /> <span className="font-semibold">{r.latest.petName}</span>
          {r.latest.comment ? <span className="mt-0.5 line-clamp-2 block text-ink/80">&ldquo;{r.latest.comment}&rdquo;</span> : null}
        </p>
      ) : (
        <p className="text-sm text-ink/80">Customers with a Lyra Pet account can review each completed groom.</p>
      )}
    </>
  );
}

export function LoyaltyTile({ d }: { d: DashboardData }) {
  const l = d.loyalty;
  if (!l.enabled) return <p className="text-sm text-ink/80">Loyalty points are switched off. Turn them on to reward regulars.</p>;
  return (
    <>
      <Stat value={l.issued30} label="points earned by customers in 30 days" mascot="biscuit" mood={l.issued30 ? "excited" : "happy"} />
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-2xl bg-surface/80 px-3 py-2">
          <dt className="text-xs text-muted">Rewards redeemed</dt>
          <dd className="font-display text-xl font-bold text-ink tabular">{l.redemptions30}</dd>
        </div>
        <div className="rounded-2xl bg-surface/80 px-3 py-2">
          <dt className="text-xs text-muted">Rewards on offer</dt>
          <dd className="font-display text-xl font-bold text-ink tabular">{l.rewards}</dd>
        </div>
      </dl>
    </>
  );
}

export function AchievementsTile({ d }: { d: DashboardData }) {
  if (!d.loyalty.achievements) return <p className="text-sm text-ink/80">Achievements are switched off for this business.</p>;
  const list = sortAchievements(achievementProgress(d.metrics)).map((a) => ({ ...a, done: a.done || !!d.awards[a.key], ratio: d.awards[a.key] ? 1 : a.ratio }));
  const done = list.filter((a) => a.done).length;
  return (
    <>
      <p className="flex items-center gap-2 text-sm font-semibold text-ink/80">
        <Trophy className="size-4 text-ink" aria-hidden /> {done} of {list.length} unlocked
      </p>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((a) => (
          <li key={a.key} className={cn("flex items-center gap-3 rounded-2xl px-3 py-2", a.done ? "bg-surface shadow-[0_0_0_2px_var(--butter)]" : "bg-surface/70")}>
            <Mascot name={a.mascot} mood={a.done ? "proud" : "curious"} pose="peek" className={cn("w-12 shrink-0", !a.done && "opacity-60 grayscale-[40%]")} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-ink">{a.title}</p>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-label={a.title} aria-valuemin={0} aria-valuemax={a.target} aria-valuenow={a.value}>
                <div className={cn("animate-fill h-full rounded-full", a.done ? "bg-butter" : "bg-primary")} style={{ width: `${Math.round(a.ratio * 100)}%` }} />
              </div>
              <p className="mt-0.5 text-xs text-muted tabular">{a.done ? (d.awards[a.key] ? `Unlocked ${new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short" }).format(new Date(d.awards[a.key] as string))}` : "Unlocked") : `${a.value} of ${a.target}`}</p>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
