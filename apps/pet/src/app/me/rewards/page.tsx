import type { Metadata } from "next";
import { Gift, Trophy } from "lucide-react";
import { Badge, Card, EmptyState } from "@lyra/ui";
import { Mascot } from "@/components/mascots/Mascot";
import { PageHeader } from "@/components/PageHeader";
import { awardLabel, levelFor } from "@/features/loyalty/engine";
import { myLoyalty } from "@/features/loyalty/queries";

export const metadata: Metadata = { title: "Rewards" };
const REASON: Record<string, string> = { appointment: "Completed groom", birthday: "Birthday points", redemption: "Reward", reversal: "Reversed", adjustment: "Adjustment" };

/** Loyalty points, levels, rewards and pets' milestone badges across the salons you visit. */
export default async function Rewards() {
  const { salons, petAwards } = await myLoyalty();
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8">
      <PageHeader title="Rewards" description="Earn points each time a groom is completed, plus a treat on your pet's birthday." back={{ href: "/me", label: "Home" }} />
      {salons.filter((s) => s.enabled).length ? (
        <ul className="flex flex-col gap-4">
          {salons.filter((s) => s.enabled).map((s) => {
            const lvl = levelFor(s.lifetime);
            return (
              <li key={s.businessSlug}>
                <Card className="flex flex-col gap-4 bg-butter-tint">
                  <div className="flex flex-wrap items-center gap-4">
                    <Mascot name="biscuit" mood={s.balance > 0 ? "excited" : "happy"} pose="peek" className="w-20" />
                    <div className="min-w-0 flex-1">
                      <h2 className="font-display text-2xl font-bold text-ink">{s.businessName}</h2>
                      <p className="font-semibold text-ink/80">{lvl.name}</p>
                    </div>
                    <p className="text-right">
                      <span className="block font-display text-4xl font-bold text-ink tabular">{s.balance}</span>
                      <span className="text-sm text-ink/80">points</span>
                    </p>
                  </div>
                  {lvl.next ? (
                    <div>
                      <div className="h-3 overflow-hidden rounded-full bg-surface" role="progressbar" aria-label={`Progress to ${lvl.next.name}`} aria-valuemin={lvl.min} aria-valuemax={lvl.next.min} aria-valuenow={s.lifetime}>
                        <div className="animate-fill h-full rounded-full bg-primary" style={{ width: `${Math.round(lvl.progress * 100)}%` }} />
                      </div>
                      <p className="mt-1 text-xs text-ink/80">{lvl.next.min - s.lifetime} more points to {lvl.next.name}</p>
                    </div>
                  ) : (
                    <p className="text-sm font-semibold text-ink">Top level reached. You&apos;re a legend!</p>
                  )}
                  <p className="text-sm text-ink/80">
                    {s.rules.perAppointment} points per completed groom{s.rules.perDollar > 0 ? ` + ${s.rules.perDollar} per $1` : ""}{s.rules.birthday > 0 ? ` · ${s.rules.birthday} on your pet's birthday` : ""}
                  </p>
                  {s.rewards.length ? (
                    <div>
                      <h3 className="flex items-center gap-2 font-display text-lg font-semibold text-ink">
                        <Gift className="size-5" aria-hidden /> Rewards
                      </h3>
                      <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                        {s.rewards.map((r) => (
                          <li key={r.id} className="flex items-center justify-between gap-2 rounded-2xl bg-surface/80 px-3 py-2">
                            <span className="text-sm font-semibold text-ink">{r.name}</span>
                            <Badge tone={s.balance >= r.cost ? "success" : "neutral"}>{s.balance >= r.cost ? "Ready to use" : `${r.cost} pts`}</Badge>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-2 text-xs text-ink/80">Ask at the salon to use a reward.</p>
                    </div>
                  ) : null}
                  {s.history.length ? (
                    <details className="text-sm">
                      <summary className="cursor-pointer font-semibold text-primary-text">Points history</summary>
                      <ul className="mt-2 flex flex-col gap-1">
                        {s.history.map((h, i) => (
                          <li key={i} className="flex justify-between gap-2">
                            <span className="text-ink/80">{h.note ?? REASON[h.reason]} · {new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short" }).format(new Date(h.at))}</span>
                            <span className="font-semibold text-ink tabular">{h.delta > 0 ? `+${h.delta}` : h.delta}</span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : null}
                </Card>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState art={<Mascot name="biscuit" mood="curious" className="w-28" />} title="No points yet" description="Points appear once a salon on Lyra Pet completes a groom for one of your pets." />
      )}
      {petAwards.length ? (
        <section aria-labelledby="badges" className="flex flex-col gap-3">
          <h2 id="badges" className="flex items-center gap-2 font-display text-2xl font-semibold text-ink">
            <Trophy className="size-6" aria-hidden /> Badges
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {petAwards.map((a) => {
              const l = awardLabel(a.key, a.petName);
              return (
                <li key={`${a.petName}-${a.key}-${a.at}`} className="flex items-center gap-3 rounded-[var(--radius-card)] bg-surface p-4 shadow-[0_0_0_2px_var(--butter)]">
                  <Mascot name="luna" mood="proud" pose="peek" className="w-12 shrink-0" />
                  <span>
                    <span className="block font-bold text-ink">{a.petName}: {l.title}</span>
                    <span className="block text-sm text-muted">{l.body}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
