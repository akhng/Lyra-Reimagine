"use client";
import { useState, useTransition } from "react";
import { Button } from "@lyra/ui";
import { redeemRewardAction } from "@/features/loyalty/actions";

/** Front desk: redeem a reward for this customer (the database checks the balance). */
export function RedeemPanel({ slug, customerId, rewards, balance }: { slug: string; customerId: string; rewards: Array<{ id: string; name: string; cost_points: number }>; balance: number }) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  if (!rewards.length) return <p className="text-sm text-muted">No rewards on offer yet.</p>;
  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-1.5">
        {rewards.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
            <span className="text-ink">
              {r.name} <span className="text-muted">· {r.cost_points} pts</span>
            </span>
            <Button type="button" size="sm" variant="secondary" disabled={pending || balance < r.cost_points} onClick={() => start(async () => { const res = await redeemRewardAction(slug, customerId, r.id); setMsg(res.ok ? { ok: true, text: `Redeemed ${r.name}. ${res.balance} points left.` } : { ok: false, text: res.error ?? "Something went wrong." }); })}>
              Redeem
            </Button>
          </li>
        ))}
      </ul>
      {msg ? (
        <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "text-sm font-semibold text-success" : "text-sm font-semibold text-danger"}>
          {msg.text}
        </p>
      ) : null}
    </div>
  );
}
