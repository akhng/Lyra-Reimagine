"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Button, FormField, Input, Select, Textarea, cn } from "@lyra/ui";
import { createAppointmentAction, freeTimesAction } from "@/features/scheduling/actions";
import { COAT_CONDITIONS, estimatePrice, formatAud, type PriceRule } from "@/features/services/pricing";

export type FormCustomer = { id: string; name: string; pets: Array<{ id: string; name: string; size: string | null; breed: string | null }> };
export type FormService = { id: string; name: string; durationMinutes: number; bufferMinutes: number; basePriceCents: number; priceFrom: boolean; rules: PriceRule[] };
type Option = { id: string; name: string };

const COAT_LABEL: Record<string, string> = { matted: "Matted coat", heavily_matted: "Heavily matted", double_coat_deshed: "Double-coat de-shed", flea_treatment: "Flea treatment" };

/** Book an appointment: customer → pet → services → groomer → day and time (free times suggested), with a live estimate and optional repeats. */
export function AppointmentForm({ slug, customers, services, groomers, locations, initial }: { slug: string; customers: FormCustomer[]; services: FormService[]; groomers: Option[]; locations: Option[]; initial: { customerId?: string; petId?: string; date: string; time?: string; groomerId?: string } }) {
  const router = useRouter();
  const [f, setF] = useState({ customerId: initial.customerId ?? "", petId: initial.petId ?? "", locationId: locations[0]?.id ?? "", groomerId: initial.groomerId ?? groomers[0]?.id ?? "", serviceIds: [] as string[], date: initial.date, time: initial.time ?? "", notes: "", coatConditions: [] as string[], repeatWeeks: 0, occurrences: 4 });
  const [query, setQuery] = useState("");
  // Free times are keyed by their inputs, so a stale answer is never shown.
  const [freeState, setFreeState] = useState<{ key: string; times: string[] } | null>(null);
  const [result, setResult] = useState<{ error?: string; fields?: Record<string, string> } | null>(null);
  const [pending, start] = useTransition();
  const customer = customers.find((c) => c.id === f.customerId);
  const pet = customer?.pets.find((p) => p.id === f.petId);
  const q = query.trim().toLowerCase();
  const matches = q ? customers.filter((c) => c.name.toLowerCase().includes(q) || c.pets.some((p) => p.name.toLowerCase().includes(q))) : customers;
  const shown = f.customerId && !matches.some((c) => c.id === f.customerId) && customer ? [customer, ...matches] : matches;
  const chosen = services.filter((s) => f.serviceIds.includes(s.id));
  const estimate = chosen.map((s) => estimatePrice({ basePriceCents: s.basePriceCents, priceFrom: s.priceFrom, rules: s.rules }, { size: (pet?.size ?? null) as never, breed: pet?.breed ?? null }, f.coatConditions));
  const total = estimate.reduce((n, e) => n + e.totalCents, 0);
  const minutes = chosen.reduce((n, s) => n + s.durationMinutes, 0);

  const freeKey = f.locationId && f.groomerId && f.date && f.serviceIds.length ? [f.locationId, f.groomerId, f.date, ...f.serviceIds].join("|") : null;
  const free = freeKey && freeState?.key === freeKey ? freeState.times : null;
  useEffect(() => {
    if (!freeKey) return;
    let live = true;
    freeTimesAction(slug, { locationId: f.locationId, groomerId: f.groomerId, date: f.date, serviceIds: f.serviceIds }).then((times) => {
      if (live) setFreeState({ key: freeKey, times });
    });
    return () => {
      live = false;
    };
  }, [slug, freeKey, f.locationId, f.groomerId, f.date, f.serviceIds]);

  const err = (k: string) => result?.fields?.[k];
  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const r = await createAppointmentAction(slug, f);
      if (r.ok && r.id) router.push(`/b/${slug}/appointments/${r.id}${r.skipped?.length ? `?skipped=${r.skipped.join(",")}` : ""}`);
      else setResult({ error: r.error, fields: r.fields });
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <fieldset className="grid gap-4 rounded-[var(--radius-card)] border border-border bg-surface p-5 shadow-[var(--shadow-card)] sm:grid-cols-2">
        <legend className="sr-only">Customer and pet</legend>
        <h2 className="font-display text-lg font-semibold text-ink sm:col-span-2">Customer and pet</h2>
        <FormField id="a-search" label="Find a customer" hint="Search by owner or pet name">
          {(p) => <Input {...p} type="search" value={query} onChange={(e) => setQuery(e.target.value)} />}
        </FormField>
        <FormField id="a-customer" label="Customer" error={err("customerId")}>
          {(p) => (
            <Select {...p} value={f.customerId} onChange={(e) => { const c = customers.find((x) => x.id === e.target.value); setF({ ...f, customerId: e.target.value, petId: c?.pets.length === 1 ? (c.pets[0]?.id ?? "") : "" }); }}>
              <option value="">Choose…</option>
              {shown.map((c) => <option key={c.id} value={c.id}>{c.name}{c.pets.length ? ` (${c.pets.map((x) => x.name).join(", ")})` : ""}</option>)}
            </Select>
          )}
        </FormField>
        <FormField id="a-pet" label="Pet" error={err("petId")}>
          {(p) => (
            <Select {...p} value={f.petId} onChange={(e) => setF({ ...f, petId: e.target.value })} disabled={!customer}>
              <option value="">{customer ? (customer.pets.length ? "Choose…" : "This customer has no pets yet") : "Choose a customer first"}</option>
              {customer?.pets.map((x) => <option key={x.id} value={x.id}>{x.name}{x.breed ? ` · ${x.breed}` : ""}</option>)}
            </Select>
          )}
        </FormField>
      </fieldset>

      <fieldset className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-border bg-surface p-5 shadow-[var(--shadow-card)]">
        <legend className="sr-only">Services</legend>
        <h2 className="font-display text-lg font-semibold text-ink">Services</h2>
        {services.length ? (
          <div className="flex flex-wrap gap-2">
            {services.map((s) => (
              <label key={s.id} className="flex min-h-11 items-center gap-2 rounded-full border border-border px-4 text-sm has-checked:border-primary has-checked:bg-primary-tint">
                <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={f.serviceIds.includes(s.id)} onChange={(e) => setF({ ...f, serviceIds: e.target.checked ? [...f.serviceIds, s.id] : f.serviceIds.filter((x) => x !== s.id) })} />
                {s.name} <span className="text-muted">· {s.durationMinutes} min</span>
              </label>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">Add services under Services &amp; pricing first.</p>
        )}
        {err("serviceIds") ? <p className="text-xs font-medium text-danger">{err("serviceIds")}</p> : null}
        <details className="text-sm">
          <summary className="cursor-pointer text-muted">Coat condition surcharges</summary>
          <div className="mt-2 flex flex-wrap gap-2">
            {COAT_CONDITIONS.map((c) => (
              <label key={c} className="flex min-h-11 items-center gap-2 text-sm">
                <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={f.coatConditions.includes(c)} onChange={(e) => setF({ ...f, coatConditions: e.target.checked ? [...f.coatConditions, c] : f.coatConditions.filter((x) => x !== c) })} /> {COAT_LABEL[c]}
              </label>
            ))}
          </div>
        </details>
        <p className="text-sm" aria-live="polite">
          {chosen.length ? <>Estimate <strong className="tabular">{estimate.some((e) => e.from) ? "from " : ""}{formatAud(total)}</strong> · {minutes} min{pet ? "" : " · choose a pet for size and breed pricing"}</> : <span className="text-muted">Choose services to see the time and estimate.</span>}
        </p>
      </fieldset>

      <fieldset className="grid gap-4 rounded-[var(--radius-card)] border border-border bg-surface p-5 shadow-[var(--shadow-card)] sm:grid-cols-2">
        <legend className="sr-only">When</legend>
        <h2 className="font-display text-lg font-semibold text-ink sm:col-span-2">When and who</h2>
        {locations.length > 1 ? (
          <FormField id="a-location" label="Location" error={err("locationId")}>
            {(p) => <Select {...p} value={f.locationId} onChange={(e) => setF({ ...f, locationId: e.target.value })}>{locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</Select>}
          </FormField>
        ) : null}
        <FormField id="a-groomer" label="Groomer" error={err("groomerId")}>
          {(p) => <Select {...p} value={f.groomerId} onChange={(e) => setF({ ...f, groomerId: e.target.value })}>{groomers.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</Select>}
        </FormField>
        <FormField id="a-date" label="Date" error={err("date")}>
          {(p) => <Input {...p} type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />}
        </FormField>
        <FormField id="a-time" label="Start time" error={err("time")} hint="Pick a free time below or type one">
          {(p) => <Input {...p} type="time" step={300} value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} />}
        </FormField>
        <div className="sm:col-span-2" aria-live="polite">
          {free === null ? null : free.length ? (
            <div>
              <p className="mb-2 text-sm font-medium">Free times</p>
              <div className="flex flex-wrap gap-2">
                {free.slice(0, 32).map((t) => (
                  <button key={t} type="button" onClick={() => setF({ ...f, time: t })} aria-pressed={f.time === t} className={cn("min-h-11 rounded-full border px-4 text-sm tabular", f.time === t ? "border-primary bg-primary text-primary-contrast" : "border-border bg-surface hover:bg-surface-2")}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted">No free times inside this groomer&apos;s hours on that day. You can still type a time.</p>
          )}
        </div>
        <FormField id="a-repeat" label="Repeat" hint="Repeats that clash are skipped and listed">
          {(p) => (
            <Select {...p} value={String(f.repeatWeeks)} onChange={(e) => setF({ ...f, repeatWeeks: Number(e.target.value) })}>
              <option value="0">Doesn&apos;t repeat</option>
              {[2, 3, 4, 5, 6, 8, 10, 12].map((w) => <option key={w} value={w}>Every {w} weeks</option>)}
            </Select>
          )}
        </FormField>
        {f.repeatWeeks > 0 ? (
          <FormField id="a-occurrences" label="Number of appointments">
            {(p) => <Input {...p} type="number" min={2} max={26} value={f.occurrences} onChange={(e) => setF({ ...f, occurrences: Number(e.target.value) })} />}
          </FormField>
        ) : null}
        <div className="sm:col-span-2">
          <FormField id="a-notes" label="Notes for the team">
            {(p) => <Textarea {...p} rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} maxLength={2000} />}
          </FormField>
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Booking…" : "Book appointment"}</Button>
        {result?.error ? <p role="alert" className="text-sm font-medium text-danger">{result.error}</p> : result?.fields ? <p role="alert" className="text-sm font-medium text-danger">Please check the highlighted fields.</p> : null}
      </div>
    </form>
  );
}
