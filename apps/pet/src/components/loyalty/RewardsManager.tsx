"use client";
import { useActionState, useTransition } from "react";
import { Badge, Button } from "@lyra/ui";
import { FormStatus, TextField } from "@/components/FormBits";
import { addRewardAction, setRewardActiveAction } from "@/features/loyalty/actions";

type Reward = { id: string; name: string; description: string | null; cost_points: number; active: boolean };

/** The rewards customers can spend points on (redeemed by the front desk). */
export function RewardsManager({ slug, rewards, canEdit }: { slug: string; rewards: Reward[]; canEdit: boolean }) {
  const [state, action, pending] = useActionState(addRewardAction.bind(null, slug), undefined);
  const [toggling, start] = useTransition();
  return (
    <div className="flex flex-col gap-5">
      {rewards.length ? (
        <ul className="flex flex-col gap-2">
          {rewards.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-surface-2 px-4 py-3">
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-ink">{r.name}</span>
                {r.description ? <span className="block text-sm text-muted">{r.description}</span> : null}
              </span>
              <Badge tone="butter">{r.cost_points} pts</Badge>
              {!r.active ? <Badge>Paused</Badge> : null}
              {canEdit ? (
                <Button type="button" variant="ghost" size="sm" disabled={toggling} onClick={() => start(async () => void (await setRewardActiveAction(slug, r.id, !r.active)))}>
                  {r.active ? "Pause" : "Offer again"}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">No rewards yet. Add one so customers have something to save for.</p>
      )}
      {canEdit ? (
        <form action={action} className="flex flex-col gap-3 rounded-[var(--radius-card)] border-2 border-dashed border-border p-4" noValidate>
          <FormStatus state={state} saved="Reward added." />
          <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
            <TextField name="name" label="Reward" state={state} placeholder="e.g. Free nail trim" />
            <TextField name="cost" label="Points needed" inputMode="numeric" state={state} />
          </div>
          <TextField name="description" label="Details (optional)" state={state} />
          <Button type="submit" variant="secondary" disabled={pending} className="self-start">
            {pending ? "Adding…" : "Add reward"}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
