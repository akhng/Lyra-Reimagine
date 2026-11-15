"use client";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, FormField, Input, Select, Textarea } from "@lyra/ui";
import { addClosureAction, addTimeOffAction, deleteClosureAction, deleteTimeOffAction, savePolicyAction, saveLocationHoursAction, saveStaffHoursAction, type ScheduleResult } from "@/features/scheduling/actions";
import { WEEKDAYS, WEEKDAY_LABEL } from "@/features/scheduling/schemas";

function Message({ r, saved = "Saved." }: { r: ScheduleResult | null; saved?: string }) {
  if (!r) return null;
  if (r.error || r.fields) return <p role="alert" className="text-sm font-medium text-danger">{r.error ?? "Please check the highlighted fields."}</p>;
  return <p role="status" className="text-sm text-success">{saved}</p>;
}
type Day = { on: boolean; from: string; to: string };
const initialDays = (rows: Array<{ weekday: number; a: string; b: string }>): Record<number, Day> =>
  Object.fromEntries(WEEKDAYS.map((d) => {
    const r = rows.find((x) => x.weekday === d);
    return [d, r ? { on: true, from: r.a, to: r.b } : { on: false, from: "09:00", to: "17:00" }];
  }));

function WeekRows({ idPrefix, days, setDays, onLabel, extra }: { idPrefix: string; days: Record<number, Day>; setDays: (d: Record<number, Day>) => void; onLabel: string; extra?: (d: number) => React.ReactNode }) {
  return (
    <div className="flex flex-col divide-y divide-border">
      {WEEKDAYS.map((d) => {
        const v = days[d] ?? { on: false, from: "09:00", to: "17:00" };
        return (
          <fieldset key={d} className="flex flex-wrap items-center gap-3 py-2">
            <legend className="sr-only">{WEEKDAY_LABEL[d]}</legend>
            <span className="w-24 text-sm font-medium" aria-hidden>{WEEKDAY_LABEL[d]}</span>
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input type="checkbox" className="size-5 accent-[var(--primary)]" checked={v.on} onChange={(e) => setDays({ ...days, [d]: { ...v, on: e.target.checked } })} aria-label={`${WEEKDAY_LABEL[d]}: ${onLabel}`} /> {onLabel}
            </label>
            {v.on ? (
              <>
                <label className="flex items-center gap-2 text-sm">From <Input id={`${idPrefix}-${d}-from`} type="time" step={900} className="w-32" value={v.from} onChange={(e) => setDays({ ...days, [d]: { ...v, from: e.target.value } })} aria-label={`${WEEKDAY_LABEL[d]} from`} /></label>
                <label className="flex items-center gap-2 text-sm">to <Input id={`${idPrefix}-${d}-to`} type="time" step={900} className="w-32" value={v.to} onChange={(e) => setDays({ ...days, [d]: { ...v, to: e.target.value } })} aria-label={`${WEEKDAY_LABEL[d]} to`} /></label>
                {extra?.(d)}
              </>
            ) : null}
          </fieldset>
        );
      })}
    </div>
  );
}

export function LocationHoursForm({ slug, locationId, hours }: { slug: string; locationId: string; hours: Array<{ weekday: number; opens: string; closes: string }> }) {
  const router = useRouter();
  const [days, setDays] = useState(initialDays(hours.map((h) => ({ weekday: h.weekday, a: h.opens, b: h.closes }))));
  const [r, setR] = useState<ScheduleResult | null>(null);
  const [pending, start] = useTransition();
  return (
    <form onSubmit={(e) => { e.preventDefault(); start(async () => { const res = await saveLocationHoursAction(slug, { locationId, hours: WEEKDAYS.filter((d) => days[d]?.on).map((d) => ({ weekday: d, opens: days[d]?.from ?? "", closes: days[d]?.to ?? "" })) }); setR(res); if (res.ok) router.refresh(); }); }} className="flex flex-col gap-3">
      <WeekRows idPrefix={`loc-${locationId}`} days={days} setDays={setDays} onLabel="Open" />
      <div className="flex items-center gap-3"><Button type="submit" disabled={pending}>Save opening hours</Button><Message r={r} saved="Opening hours saved." /></div>
    </form>
  );
}

export function StaffHoursForm({ slug, memberId, name, locations, hours }: { slug: string; memberId: string; name: string; locations: Array<{ id: string; name: string }>; hours: Array<{ weekday: number; locationId: string; starts: string; ends: string }> }) {
  const router = useRouter();
  const [days, setDays] = useState(initialDays(hours.map((h) => ({ weekday: h.weekday, a: h.starts, b: h.ends }))));
  const [where, setWhere] = useState<Record<number, string>>(Object.fromEntries(WEEKDAYS.map((d) => [d, hours.find((h) => h.weekday === d)?.locationId ?? locations[0]?.id ?? ""])));
  const [r, setR] = useState<ScheduleResult | null>(null);
  const [pending, start] = useTransition();
  return (
    <form onSubmit={(e) => { e.preventDefault(); start(async () => { const res = await saveStaffHoursAction(slug, { memberId, hours: WEEKDAYS.filter((d) => days[d]?.on).map((d) => ({ weekday: d, locationId: where[d] ?? "", starts: days[d]?.from ?? "", ends: days[d]?.to ?? "" })) }); setR(res); if (res.ok) router.refresh(); }); }} className="flex flex-col gap-3">
      <WeekRows
        idPrefix={`staff-${memberId}`}
        days={days}
        setDays={setDays}
        onLabel="Working"
        extra={locations.length > 1 ? (d) => (
          <label className="flex items-center gap-2 text-sm">at
            <Select className="w-48" value={where[d]} onChange={(e) => setWhere({ ...where, [d]: e.target.value })} aria-label={`${WEEKDAY_LABEL[d]} location`}>{locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</Select>
          </label>
        ) : undefined}
      />
      <div className="flex items-center gap-3"><Button type="submit" disabled={pending}>Save {name}&apos;s hours</Button><Message r={r} saved="Hours saved." /></div>
    </form>
  );
}

export function TimeOffForm({ slug, members, today }: { slug: string; members: Array<{ id: string; name: string }>; today: string }) {
  const router = useRouter();
  const [f, setF] = useState({ memberId: members[0]?.id ?? "", startDate: today, startTime: "00:00", endDate: today, endTime: "23:59", reason: "" });
  const [r, setR] = useState<ScheduleResult | null>(null);
  const [pending, start] = useTransition();
  return (
    <form onSubmit={(e) => { e.preventDefault(); start(async () => { const res = await addTimeOffAction(slug, f); setR(res); if (res.ok) router.refresh(); }); }} className="grid gap-3 sm:grid-cols-3">
      <FormField id="to-member" label="Team member" error={r?.fields?.memberId}>{(p) => <Select {...p} value={f.memberId} onChange={(e) => setF({ ...f, memberId: e.target.value })}>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</Select>}</FormField>
      <FormField id="to-start" label="From" error={r?.fields?.startDate}>{(p) => <Input {...p} type="date" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} />}</FormField>
      <FormField id="to-start-time" label="From time">{(p) => <Input {...p} type="time" value={f.startTime} onChange={(e) => setF({ ...f, startTime: e.target.value })} />}</FormField>
      <FormField id="to-reason" label="Reason (optional)">{(p) => <Input {...p} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} maxLength={200} />}</FormField>
      <FormField id="to-end" label="Until" error={r?.fields?.endDate}>{(p) => <Input {...p} type="date" value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} />}</FormField>
      <FormField id="to-end-time" label="Until time">{(p) => <Input {...p} type="time" value={f.endTime} onChange={(e) => setF({ ...f, endTime: e.target.value })} />}</FormField>
      <div className="flex items-center gap-3 sm:col-span-3"><Button type="submit" variant="secondary" disabled={pending}>Add time off</Button><Message r={r} saved="Time off added." /></div>
    </form>
  );
}

export function ClosureForm({ slug, locations, today }: { slug: string; locations: Array<{ id: string; name: string }>; today: string }) {
  const router = useRouter();
  const [f, setF] = useState({ locationId: "", startsOn: today, endsOn: today, reason: "" });
  const [r, setR] = useState<ScheduleResult | null>(null);
  const [pending, start] = useTransition();
  return (
    <form onSubmit={(e) => { e.preventDefault(); start(async () => { const res = await addClosureAction(slug, f); setR(res); if (res.ok) router.refresh(); }); }} className="grid gap-3 sm:grid-cols-4">
      <FormField id="cl-loc" label="Where">{(p) => <Select {...p} value={f.locationId} onChange={(e) => setF({ ...f, locationId: e.target.value })}><option value="">Whole business</option>{locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</Select>}</FormField>
      <FormField id="cl-from" label="First day closed">{(p) => <Input {...p} type="date" value={f.startsOn} onChange={(e) => setF({ ...f, startsOn: e.target.value })} />}</FormField>
      <FormField id="cl-to" label="Last day closed" error={r?.fields?.endsOn}>{(p) => <Input {...p} type="date" value={f.endsOn} onChange={(e) => setF({ ...f, endsOn: e.target.value })} />}</FormField>
      <FormField id="cl-reason" label="Reason (optional)">{(p) => <Input {...p} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} maxLength={120} placeholder="e.g. Christmas Day" />}</FormField>
      <div className="flex items-center gap-3 sm:col-span-4"><Button type="submit" variant="secondary" disabled={pending}>Add closure</Button><Message r={r} saved="Closure added." /></div>
    </form>
  );
}

export function RemoveButton({ slug, kind, id, label }: { slug: string; kind: "timeOff" | "closure"; id: string; label: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button type="button" variant="ghost" size="icon" aria-label={label} disabled={pending} onClick={() => start(async () => { await (kind === "timeOff" ? deleteTimeOffAction : deleteClosureAction)(slug, id); router.refresh(); })}>
      <Trash2 className="size-4" aria-hidden />
    </Button>
  );
}

export function PolicyForm({ slug, policy, bookingUrl }: { slug: string; policy: { onlineEnabled: boolean; minNoticeMinutes: number; maxDaysAhead: number; slotStepMinutes: number; cancellationHours: number; policyText: string | null }; bookingUrl: string }) {
  const router = useRouter();
  const [f, setF] = useState({ ...policy, policyText: policy.policyText ?? "" });
  const [r, setR] = useState<ScheduleResult | null>(null);
  const [pending, start] = useTransition();
  return (
    <form onSubmit={(e) => { e.preventDefault(); start(async () => { const res = await savePolicyAction(slug, f); setR(res); if (res.ok) router.refresh(); }); }} className="grid gap-4 sm:grid-cols-2">
      <label className="flex min-h-11 items-center gap-3 text-sm sm:col-span-2">
        <input type="checkbox" className="size-5 accent-[var(--primary)]" checked={f.onlineEnabled} onChange={(e) => setF({ ...f, onlineEnabled: e.target.checked })} />
        <span>Take bookings online at <a href={bookingUrl} className="font-medium text-primary-text underline" target="_blank" rel="noreferrer">{bookingUrl}</a></span>
      </label>
      <FormField id="p-notice" label="Minimum notice (hours)" hint="How soon before a start time customers can book online" error={r?.fields?.minNoticeMinutes}>{(p) => <Input {...p} type="number" min={0} max={336} value={f.minNoticeMinutes / 60} onChange={(e) => setF({ ...f, minNoticeMinutes: Math.round(Number(e.target.value) * 60) })} />}</FormField>
      <FormField id="p-ahead" label="Book up to (days ahead)" error={r?.fields?.maxDaysAhead}>{(p) => <Input {...p} type="number" min={1} max={365} value={f.maxDaysAhead} onChange={(e) => setF({ ...f, maxDaysAhead: Number(e.target.value) })} />}</FormField>
      <FormField id="p-step" label="Offer start times every">{(p) => <Select {...p} value={String(f.slotStepMinutes)} onChange={(e) => setF({ ...f, slotStepMinutes: Number(e.target.value) })}>{[5, 10, 15, 20, 30, 60].map((m) => <option key={m} value={m}>{m} minutes</option>)}</Select>}</FormField>
      <FormField id="p-cancel" label="Online cancel or change up to (hours before)" error={r?.fields?.cancellationHours}>{(p) => <Input {...p} type="number" min={0} max={336} value={f.cancellationHours} onChange={(e) => setF({ ...f, cancellationHours: Number(e.target.value) })} />}</FormField>
      <div className="sm:col-span-2">
        <FormField id="p-text" label="Booking policy shown to customers" hint="e.g. arrival time, cancellation and late policy">{(p) => <Textarea {...p} rows={3} value={f.policyText} onChange={(e) => setF({ ...f, policyText: e.target.value })} maxLength={2000} />}</FormField>
      </div>
      <div className="flex items-center gap-3 sm:col-span-2"><Button type="submit" disabled={pending}>Save online booking</Button><Message r={r} saved="Online booking saved." /></div>
    </form>
  );
}
