"use client";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, cn, FormField, Input, Select, Textarea } from "@lyra/ui";
import { submitRequestAction } from "@/features/portal/actions";
import type { Listing, OwnerPet } from "@/features/portal/queries";
import { PART_LABEL, PARTS } from "@/features/portal/schemas";
import { addDays, fromLocal, isoWeekday, localToday, minutesToHhmm } from "@/features/scheduling/time";
import { formatAud } from "@/features/services/pricing";
import { AgreeNotice } from "../legal/LegalLinks";

/**
 * Steps 3–7 of the booking request (ADR 0003): services, a preferred time or
 * flexible days, instructions, review, submit. Prices are the salon's
 * estimate for the pet's size; the salon confirms the real time.
 */
type Window = { date: string; part: (typeof PARTS)[number] };
const STEPS = ["Services", "When", "Notes", "Review"] as const;

export function BookingWizard({ pet, listing, payOnline }: { pet: OwnerPet; listing: Listing; payOnline: boolean }) {
  const router = useRouter();
  const tz = listing.timezone;
  const today = localToday(tz);
  const [step, setStep] = useState(0);
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [mode, setMode] = useState<"specific" | "flexible">("specific");
  const [date, setDate] = useState(addDays(today, 1));
  const [time, setTime] = useState("");
  const [windows, setWindows] = useState<Window[]>([{ date: addDays(today, 1), part: "any" }]);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const chosen = listing.services.filter((s) => serviceIds.includes(s.id));
  const price = (s: Listing["services"][number]) => (pet.size && s.sizePrices[pet.size]) || s.priceCents;
  const total = chosen.reduce((sum, s) => sum + price(s), 0);
  const minutes = chosen.reduce((sum, s) => sum + s.minutes, 0);
  const from = chosen.some((s) => s.priceFrom);
  const hours = listing.hours.filter((h) => h.weekday === isoWeekday(date));
  const times = hours.flatMap((h) => {
    const [oh, om] = h.opens.split(":").map(Number);
    const [ch, cm] = h.closes.split(":").map(Number);
    const out: string[] = [];
    for (let m = (oh ?? 0) * 60 + (om ?? 0); m + Math.max(minutes, 30) <= (ch ?? 0) * 60 + (cm ?? 0); m += 30) out.push(minutesToHhmm(m));
    return out;
  });
  const whenText = mode === "specific" ? (time ? `${new Intl.DateTimeFormat("en-AU", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`))} at ${time}` : "") : windows.map((w) => `${new Intl.DateTimeFormat("en-AU", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${w.date}T00:00:00Z`))} (${PART_LABEL[w.part].toLowerCase()})`).join(", ");

  function next() {
    setError(null);
    if (step === 0 && !serviceIds.length) return setError("Choose at least one service.");
    if (step === 1 && mode === "specific" && !time) return setError("Choose a time, or switch to flexible days.");
    if (step === 1 && mode === "flexible" && !windows.length) return setError("Add at least one day.");
    setStep(step + 1);
  }
  function submit() {
    setError(null);
    startTransition(async () => {
      const [hh, mm] = time.split(":").map(Number);
      const preferredStart = mode === "specific" && time ? new Date(fromLocal(date, (hh ?? 0) * 60 + (mm ?? 0), tz)).toISOString() : null;
      const r = await submitRequestAction({ slug: listing.slug, ownerPetId: pet.id, serviceIds, preferredStart, windows: mode === "flexible" ? windows : [], notes });
      if (r.ok && r.payUrl) window.location.assign(r.payUrl);
      else if (r.ok) router.push(`/me/requests/${r.id}?new=1`);
      else setError(r.error);
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <ol className="flex flex-wrap gap-2" aria-label="Steps">
        {STEPS.map((s, i) => (
          <li key={s} aria-current={i === step ? "step" : undefined} className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold", i < step ? "bg-mint-tint text-success" : i === step ? "bg-primary text-white" : "bg-surface-2 text-muted")}>
            {i < step ? <Check className="size-4" aria-hidden /> : <span aria-hidden>{i + 3}</span>} {s}
          </li>
        ))}
      </ol>

      {step === 0 ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 font-display text-xl font-semibold text-ink">What would {pet.name} like?</legend>
          {listing.services.map((s) => (
            <label key={s.id} className="lift flex cursor-pointer items-center gap-3 rounded-[var(--radius-card)] border-2 border-border bg-surface p-4 has-[:checked]:border-primary has-[:checked]:bg-primary-tint has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary/40">
              <input type="checkbox" className="size-5 accent-[var(--primary)]" checked={serviceIds.includes(s.id)} onChange={(e) => setServiceIds(e.target.checked ? [...serviceIds, s.id] : serviceIds.filter((x) => x !== s.id))} />
              <span className="min-w-0 flex-1">
                <span className="block font-bold text-ink">{s.name}</span>
                <span className="block text-sm text-muted">{[s.description, `${s.minutes} min`].filter(Boolean).join(" · ")}</span>
              </span>
              <span className="shrink-0 font-display text-lg font-bold text-ink tabular">{s.priceFrom ? "from " : ""}{formatAud(price(s))}</span>
            </label>
          ))}
        </fieldset>
      ) : null}

      {step === 1 ? (
        <div className="flex flex-col gap-4">
          <h2 className="font-display text-xl font-semibold text-ink">When suits you?</h2>
          <div role="radiogroup" aria-label="Timing" className="grid grid-cols-2 gap-2 sm:max-w-md">
            {(["specific", "flexible"] as const).map((m) => (
              <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)} className={cn("min-h-11 rounded-full border-2 px-4 text-sm font-bold", mode === m ? "border-primary bg-primary-tint text-ink" : "border-border bg-surface text-muted")}>
                {m === "specific" ? "A particular time" : "I'm flexible"}
              </button>
            ))}
          </div>
          {mode === "specific" ? (
            <div className="grid gap-4 sm:max-w-md sm:grid-cols-2">
              <FormField id="w-date" label="Date">
                {(p) => <Input {...p} type="date" min={today} max={addDays(today, 90)} value={date} onChange={(e) => { setDate(e.target.value); setTime(""); }} />}
              </FormField>
              <FormField id="w-time" label="Time" hint={times.length ? `The salon's hours that day` : "The salon is closed that day"}>
                {(p) => (
                  <Select {...p} value={time} onChange={(e) => setTime(e.target.value)} disabled={!times.length}>
                    <option value="">Choose…</option>
                    {times.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </Select>
                )}
              </FormField>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {windows.map((w, i) => (
                <div key={i} className="flex flex-wrap items-end gap-3">
                  <FormField id={`w-${i}-date`} label={`Day ${i + 1}`}>
                    {(p) => <Input {...p} type="date" min={today} max={addDays(today, 90)} value={w.date} onChange={(e) => setWindows(windows.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)))} />}
                  </FormField>
                  <FormField id={`w-${i}-part`} label="Time of day">
                    {(p) => (
                      <Select {...p} value={w.part} onChange={(e) => setWindows(windows.map((x, j) => (j === i ? { ...x, part: e.target.value as Window["part"] } : x)))}>
                        {PARTS.map((part) => (
                          <option key={part} value={part}>
                            {PART_LABEL[part]}
                          </option>
                        ))}
                      </Select>
                    )}
                  </FormField>
                  {windows.length > 1 ? (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setWindows(windows.filter((_, j) => j !== i))}>
                      Remove
                    </Button>
                  ) : null}
                </div>
              ))}
              {windows.length < 3 ? (
                <Button type="button" variant="secondary" size="sm" className="self-start" onClick={() => setWindows([...windows, { date: addDays(windows.at(-1)?.date ?? today, 1), part: "any" }])}>
                  Add another day
                </Button>
              ) : null}
            </div>
          )}
        </div>
      ) : null}

      {step === 2 ? (
        <FormField id="w-notes" label={`Anything the groomer should know about ${pet.name}?`} hint="Optional. Your pet's saved care notes are shared automatically.">
          {(p) => <Textarea {...p} value={notes} maxLength={1000} onChange={(e) => setNotes(e.target.value)} rows={4} />}
        </FormField>
      ) : null}

      {step === 3 ? (
        <section aria-labelledby="review" className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-surface p-5 shadow-[var(--shadow-card)]">
          <h2 id="review" className="font-display text-xl font-semibold text-ink">Check your request</h2>
          <dl className="grid gap-2 text-sm sm:grid-cols-[10rem_1fr]">
            <dt className="text-muted">Pet</dt>
            <dd className="font-semibold text-ink">{pet.name}</dd>
            <dt className="text-muted">Salon</dt>
            <dd className="font-semibold text-ink">{listing.name}</dd>
            <dt className="text-muted">Services</dt>
            <dd className="font-semibold text-ink">{chosen.map((s) => s.name).join(", ")}</dd>
            <dt className="text-muted">When</dt>
            <dd className="font-semibold text-ink">{mode === "specific" ? whenText : `Flexible: ${whenText}`}</dd>
            <dt className="text-muted">About</dt>
            <dd className="font-semibold text-ink">{minutes} minutes</dd>
            <dt className="text-muted">Estimate</dt>
            <dd className="font-display text-2xl font-bold text-ink tabular">{from ? "from " : ""}{formatAud(total)}</dd>
            {notes ? (
              <>
                <dt className="text-muted">Notes</dt>
                <dd className="text-ink">{notes}</dd>
              </>
            ) : null}
          </dl>
          <p className="text-sm text-muted">
            {payOnline
              ? `You'll pay ${formatAud(total)} securely with Stripe now. ${listing.name} then confirms a time; if they can't, you're refunded in full.`
              : `This is a request: ${listing.name} checks their groomers and confirms a time before anything is booked. You pay at the salon.`}
          </p>
        </section>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm font-semibold text-danger">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        {step > 0 ? (
          <Button type="button" variant="secondary" onClick={() => setStep(step - 1)} disabled={pending}>
            <ChevronLeft aria-hidden /> Back
          </Button>
        ) : null}
        {step < 3 ? (
          <Button type="button" onClick={next}>
            Next <ChevronRight aria-hidden />
          </Button>
        ) : (
          <Button type="button" size="lg" onClick={submit} disabled={pending}>
            {pending ? "Sending…" : payOnline ? `Pay ${formatAud(total)} and send` : "Send request"}
          </Button>
        )}
        {chosen.length ? <span className="text-sm font-semibold text-ink tabular">{from ? "from " : ""}{formatAud(total)} · {minutes} min</span> : null}
      </div>
      {step === 3 ? <AgreeNotice action={payOnline ? "paying and sending this request" : "sending this request"} /> : null}
    </div>
  );
}
