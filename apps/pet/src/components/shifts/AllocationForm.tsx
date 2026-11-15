"use client";
import { useActionState, useState } from "react";
import { Button, cn } from "@lyra/ui";
import { CheckField, FormStatus, TextField } from "@/components/FormBits";
import { saveAllocationAction } from "@/features/shifts/actions";

const MODES = [
  { value: "manual", title: "Front desk reviews", body: "Every request waits for your front desk to confirm a groomer and time." },
  { value: "open", title: "Open to groomers", body: "Requests go straight to the shift board. The first eligible groomer to accept gets it." },
  { value: "automatic", title: "Automatic", body: "Lyra Pet books the first capable, available groomer at a requested time; otherwise it goes to the shift board." },
  { value: "assigned_only", title: "Assigned groomer only", body: "Your front desk assigns each request to one groomer, who accepts it." },
] as const;

type Settings = { mode: string; acceptHours: number; commission: number | null; ownHours: boolean; capabilities: string[]; services: Array<{ id: string; name: string }> };

/** How booking requests are allocated, deadlines, commission and which services each groomer does. */
export function AllocationForm({ slug, settings, groomers }: { slug: string; settings: Settings; groomers: Array<{ id: string; name: string }> }) {
  const [state, action, pending] = useActionState(saveAllocationAction.bind(null, slug), undefined);
  const [restricted, setRestricted] = useState(() => new Set(settings.capabilities.map((c) => c.split(":")[0] ?? "")));
  return (
    <form action={action} className="flex flex-col gap-6" noValidate>
      <FormStatus state={state} saved="Allocation settings saved." />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-display text-lg font-semibold text-ink">How requests are allocated</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {MODES.map((m) => (
            <label key={m.value} className="flex cursor-pointer flex-col gap-1 rounded-[var(--radius-card)] border-2 border-border bg-surface p-4 has-[:checked]:border-primary has-[:checked]:bg-primary-tint has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary/40">
              <span className="flex items-center gap-2 font-bold text-ink">
                <input type="radio" name="mode" value={m.value} defaultChecked={settings.mode === m.value} className="size-4 accent-[var(--primary)]" /> {m.title}
              </span>
              <span className="text-sm text-muted">{m.body}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="acceptHours" label="Hours groomers have to accept" inputMode="numeric" state={state} defaultValue={settings.acceptHours} hint="Unclaimed requests return to the front desk. Never later than an hour before the requested time." />
        <TextField name="commission" label="Groomer commission (%)" inputMode="numeric" state={state} defaultValue={settings.commission} hint="Optional. Shown on the shift board as an estimate." />
      </div>
      <CheckField name="ownHours" label="Groomers can set their own weekly hours" defaultChecked={settings.ownHours} hint="From the shift board. Otherwise owners and managers set team hours." />
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 font-display text-lg font-semibold text-ink">Services each groomer does</legend>
        <p className="text-sm text-muted">Groomers can take any request unless you limit them to some services.</p>
        {groomers.map((g) => (
          <div key={g.id} className="rounded-[var(--radius-card)] border border-border bg-surface p-4">
            <label className="flex items-center gap-2 text-sm font-bold text-ink">
              <input
                type="checkbox"
                name="restricted"
                value={g.id}
                checked={restricted.has(g.id)}
                onChange={(e) => {
                  const next = new Set(restricted);
                  if (e.target.checked) next.add(g.id);
                  else next.delete(g.id);
                  setRestricted(next);
                }}
                className="size-5 accent-[var(--primary)]"
              />
              Only some services for {g.name}
            </label>
            <div className={cn("mt-3 flex flex-wrap gap-2", !restricted.has(g.id) && "hidden")}>
              {settings.services.map((s) => (
                <label key={s.id} className="inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-border px-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary-tint">
                  <input type="checkbox" name="cap" value={`${g.id}:${s.id}`} defaultChecked={settings.capabilities.includes(`${g.id}:${s.id}`)} className="size-4 accent-[var(--primary)]" /> {s.name}
                </label>
              ))}
            </div>
          </div>
        ))}
      </fieldset>
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Saving…" : "Save allocation settings"}
      </Button>
    </form>
  );
}
