"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Button, FormField, Input, Select, Textarea, cn } from "@lyra/ui";
import { bookOnlineAction } from "@/features/booking/actions";
import type { OnlineContext } from "@/features/booking/context";
import { availability, blockFor } from "@/features/scheduling/availability";
import { addDays, localToday, minutesToHhmm, toLocal } from "@/features/scheduling/time";
import { estimatePrice, formatAud } from "@/features/services/pricing";
import { SlotPicker } from "./SlotPicker";

const SIZES = [["", "Not sure"], ["toy", "Toy"], ["small", "Small"], ["medium", "Medium"], ["large", "Large"], ["giant", "Giant"]] as const;

/** The public booking flow. Times come from the availability engine; the server re-checks the booking. */
export function BookingFlow({ ctx, nowMs }: { ctx: OnlineContext; nowMs: number }) {
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [locationId, setLocationId] = useState(ctx.locations[0]?.id ?? "");
  const [groomerId, setGroomerId] = useState("");
  const [date, setDate] = useState<string | null>(null);
  const [startsAt, setStartsAt] = useState<string | null>(null);
  const [d, setD] = useState({ firstName: "", lastName: "", email: "", mobile: "", petName: "", species: "dog", size: "", breed: "", notes: "", marketingConsent: false, agree: false, website: "" });
  const [openedAt] = useState(nowMs);
  const [result, setResult] = useState<{ error?: string; fields?: Record<string, string> } | null>(null);
  const [pending, start] = useTransition();
  const location = ctx.locations.find((l) => l.id === locationId);
  const chosen = ctx.services.filter((s) => serviceIds.includes(s.id));
  const block = blockFor(chosen);
  const tz = location?.timezone ?? ctx.business.timezone;
  const today = localToday(tz, new Date(nowMs));
  const days = chosen.length && location
    ? availability({ timeZone: tz, locationId: location.id, locationHours: location.hours, staffHours: ctx.staffHours, busy: ctx.busy, closures: ctx.closures, policy: ctx.policy, ...block, groomerId: groomerId || null, from: today, to: addDays(today, Math.min(ctx.policy.maxDaysAhead, 28)), now: new Date(nowMs) })
    : [];
  const prices = chosen.map((s) => estimatePrice({ basePriceCents: s.basePriceCents, priceFrom: s.priceFrom, rules: s.rules }, { size: (d.size || null) as never, breed: d.breed || null }));
  const total = prices.reduce((n, p) => n + p.totalCents, 0);
  const err = (k: string) => result?.fields?.[k];
  const reset = () => { setStartsAt(null); setDate(null); };

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const r = await bookOnlineAction(ctx.business.slug, { locationId, groomerId, serviceIds, startsAt: startsAt ?? "", ...d, openedAt });
      if (r) setResult(r);
    });
  }

  const step = "flex flex-col gap-4 rounded-[var(--radius-card)] border border-border bg-surface p-5 shadow-[var(--shadow-card)]";
  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <section aria-labelledby="s-services" className={step}>
        <h2 id="s-services" className="font-display text-lg font-semibold text-ink">1. Choose services</h2>
        {ctx.services.length ? (
          <ul className="grid gap-2 sm:grid-cols-2">
            {ctx.services.map((s) => (
              <li key={s.id}>
                <label className={cn("flex min-h-16 cursor-pointer items-start gap-3 rounded-[var(--radius-control)] border p-3", serviceIds.includes(s.id) ? "border-primary bg-primary-tint" : "border-border")}>
                  <input type="checkbox" className="mt-1 size-5 accent-[var(--primary)]" checked={serviceIds.includes(s.id)} onChange={(e) => { setServiceIds(e.target.checked ? [...serviceIds, s.id] : serviceIds.filter((x) => x !== s.id)); reset(); }} />
                  <span className="min-w-0">
                    <span className="block font-medium">{s.name}</span>
                    <span className="block text-sm text-muted">{s.durationMinutes} min · {s.priceFrom || s.rules.length ? "from " : ""}{formatAud(Math.min(s.basePriceCents, ...s.rules.map((r) => r.priceCents)))}</span>
                    {s.description ? <span className="mt-1 block text-xs text-muted">{s.description}</span> : null}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted">This salon hasn&apos;t listed services for online booking yet.</p>}
        {err("serviceIds") ? <p className="text-xs font-medium text-danger">{err("serviceIds")}</p> : null}
      </section>

      <section aria-labelledby="s-when" className={step}>
        <h2 id="s-when" className="font-display text-lg font-semibold text-ink">2. Pick a time</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {ctx.locations.length > 1 ? (
            <FormField id="b-location" label="Location">{(p) => <Select {...p} value={locationId} onChange={(e) => { setLocationId(e.target.value); reset(); }}>{ctx.locations.map((l) => <option key={l.id} value={l.id}>{l.name}{l.suburb ? `, ${l.suburb}` : ""}</option>)}</Select>}</FormField>
          ) : location ? <p className="text-sm"><span className="text-muted">Location:</span> {location.name}{location.addressLine ? `, ${location.addressLine}` : ""}{location.suburb ? `, ${location.suburb}` : ""}</p> : null}
          <FormField id="b-groomer" label="Groomer">{(p) => <Select {...p} value={groomerId} onChange={(e) => { setGroomerId(e.target.value); reset(); }}><option value="">Any groomer</option>{ctx.groomers.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</Select>}</FormField>
        </div>
        {chosen.length ? (
          <SlotPicker days={days} date={date} startsAt={startsAt} onDate={(x) => { setDate(x); setStartsAt(null); }} onTime={(iso) => setStartsAt(iso)} />
        ) : <p className="text-sm text-muted">Choose at least one service to see free times.</p>}
        {err("startsAt") ? <p className="text-xs font-medium text-danger">{err("startsAt")}</p> : null}
      </section>

      <section aria-labelledby="s-details" className={step}>
        <h2 id="s-details" className="font-display text-lg font-semibold text-ink">3. Your details</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField id="b-first" label="First name" error={err("firstName")}>{(p) => <Input {...p} autoComplete="given-name" value={d.firstName} onChange={(e) => setD({ ...d, firstName: e.target.value })} />}</FormField>
          <FormField id="b-last" label="Last name" error={err("lastName")}>{(p) => <Input {...p} autoComplete="family-name" value={d.lastName} onChange={(e) => setD({ ...d, lastName: e.target.value })} />}</FormField>
          <FormField id="b-email" label="Email" error={err("email")}>{(p) => <Input {...p} type="email" autoComplete="email" value={d.email} onChange={(e) => setD({ ...d, email: e.target.value })} />}</FormField>
          <FormField id="b-mobile" label="Mobile" error={err("mobile")}>{(p) => <Input {...p} type="tel" autoComplete="tel" value={d.mobile} onChange={(e) => setD({ ...d, mobile: e.target.value })} />}</FormField>
          <FormField id="b-pet" label="Pet's name" error={err("petName")}>{(p) => <Input {...p} value={d.petName} onChange={(e) => setD({ ...d, petName: e.target.value })} />}</FormField>
          <FormField id="b-species" label="Pet">{(p) => <Select {...p} value={d.species} onChange={(e) => setD({ ...d, species: e.target.value })}><option value="dog">Dog</option><option value="cat">Cat</option><option value="other">Other</option></Select>}</FormField>
          <FormField id="b-size" label="Size" hint="Used for size-based prices">{(p) => <Select {...p} value={d.size} onChange={(e) => setD({ ...d, size: e.target.value })}>{SIZES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>}</FormField>
          <FormField id="b-breed" label="Breed (optional)">{(p) => <Input {...p} value={d.breed} onChange={(e) => setD({ ...d, breed: e.target.value })} maxLength={80} />}</FormField>
          <div className="sm:col-span-2"><FormField id="b-notes" label="Anything the groomer should know? (optional)" hint="e.g. first visit, nervous with dryers, matting">{(p) => <Textarea {...p} rows={2} value={d.notes} onChange={(e) => setD({ ...d, notes: e.target.value })} maxLength={1000} />}</FormField></div>
          {/* Hidden from people; bots tend to fill it in. */}
          <div aria-hidden className="absolute -left-[9999px]"><label>Website<input tabIndex={-1} autoComplete="off" value={d.website} onChange={(e) => setD({ ...d, website: e.target.value })} /></label></div>
        </div>
      </section>

      <section aria-labelledby="s-confirm" className={step}>
        <h2 id="s-confirm" className="font-display text-lg font-semibold text-ink">4. Confirm</h2>
        {startsAt && chosen.length ? (
          <p className="text-sm">
            <strong>{chosen.map((s) => s.name).join(", ")}</strong> on {new Intl.DateTimeFormat("en-AU", { weekday: "long", day: "numeric", month: "long", timeZone: tz }).format(new Date(startsAt))} at {minutesToHhmm(toLocal(Date.parse(startsAt), tz).minutes)} · {block.durationMinutes} min · estimate {prices.some((p) => p.from) || !d.size ? "from " : ""}<span className="tabular">{formatAud(total)}</span>. Final price depends on your pet&apos;s coat and size on the day.
          </p>
        ) : <p className="text-sm text-muted">Choose services and a time above.</p>}
        {ctx.policy.policyText ? <p className="rounded-[var(--radius-control)] bg-surface-2 px-4 py-3 text-sm whitespace-pre-line">{ctx.policy.policyText}</p> : null}
        <p className="text-sm text-muted">You can cancel or change online up to {ctx.policy.cancellationHours} hours before your appointment.</p>
        <label className="flex min-h-11 items-start gap-3 text-sm">
          <input type="checkbox" className="mt-0.5 size-5 accent-[var(--primary)]" checked={d.agree} onChange={(e) => setD({ ...d, agree: e.target.checked })} aria-invalid={err("agree") ? true : undefined} />
          <span>
            I agree to the booking policy, to {ctx.business.name} using my details to manage this booking, and to Lyra Pet&apos;s{" "}
            <Link href="/terms" className="font-semibold text-primary-text underline underline-offset-2">Customer Terms</Link> and{" "}
            <Link href="/privacy" className="font-semibold text-primary-text underline underline-offset-2">Privacy Policy</Link>.
          </span>
        </label>
        {err("agree") ? <p className="text-xs font-medium text-danger">{err("agree")}</p> : null}
        <label className="flex min-h-11 items-start gap-3 text-sm">
          <input type="checkbox" className="mt-0.5 size-5 accent-[var(--primary)]" checked={d.marketingConsent} onChange={(e) => setD({ ...d, marketingConsent: e.target.checked })} />
          <span>Send me occasional news and offers from {ctx.business.name} (optional; you can unsubscribe any time).</span>
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" size="lg" disabled={pending || !startsAt}>{pending ? "Booking…" : "Book appointment"}</Button>
          {result?.error ? <p role="alert" className="text-sm font-medium text-danger">{result.error}</p> : result?.fields ? <p role="alert" className="text-sm font-medium text-danger">Please check the highlighted details.</p> : null}
        </div>
      </section>
    </form>
  );
}
