"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Button, FormField, Input, Select, Textarea } from "@lyra/ui";
import { addWaitlistAction, setWaitlistStatusAction, type ScheduleResult } from "@/features/scheduling/actions";
import type { FormCustomer } from "./AppointmentForm";

export function WaitlistForm({ slug, customers, services, groomers, today }: { slug: string; customers: FormCustomer[]; services: Array<{ id: string; name: string }>; groomers: Array<{ id: string; name: string }>; today: string }) {
  const router = useRouter();
  const [f, setF] = useState({ customerId: "", petId: "", serviceIds: [] as string[], preferredGroomerId: "", earliestOn: today, latestOn: today, notes: "" });
  const [query, setQuery] = useState("");
  const [r, setR] = useState<ScheduleResult | null>(null);
  const [pending, start] = useTransition();
  const customer = customers.find((c) => c.id === f.customerId);
  const shown = useMemo(() => (query ? customers.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()) || c.pets.some((p) => p.name.toLowerCase().includes(query.toLowerCase()))) : customers), [customers, query]);
  return (
    <form onSubmit={(e) => { e.preventDefault(); start(async () => { const res = await addWaitlistAction(slug, f); setR(res); if (res.ok) { setF({ ...f, customerId: "", petId: "", notes: "" }); router.refresh(); } }); }} className="grid gap-3 sm:grid-cols-2">
      <FormField id="w-search" label="Find a customer">{(p) => <Input {...p} type="search" value={query} onChange={(e) => setQuery(e.target.value)} />}</FormField>
      <FormField id="w-customer" label="Customer" error={r?.fields?.customerId}>{(p) => <Select {...p} value={f.customerId} onChange={(e) => { const c = customers.find((x) => x.id === e.target.value); setF({ ...f, customerId: e.target.value, petId: c?.pets.length === 1 ? (c.pets[0]?.id ?? "") : "" }); }}><option value="">Choose…</option>{shown.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>}</FormField>
      <FormField id="w-pet" label="Pet" error={r?.fields?.petId}>{(p) => <Select {...p} value={f.petId} onChange={(e) => setF({ ...f, petId: e.target.value })} disabled={!customer}><option value="">Choose…</option>{customer?.pets.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select>}</FormField>
      <FormField id="w-groomer" label="Preferred groomer">{(p) => <Select {...p} value={f.preferredGroomerId} onChange={(e) => setF({ ...f, preferredGroomerId: e.target.value })}><option value="">Anyone</option>{groomers.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</Select>}</FormField>
      <FormField id="w-from" label="Earliest date">{(p) => <Input {...p} type="date" value={f.earliestOn} onChange={(e) => setF({ ...f, earliestOn: e.target.value })} />}</FormField>
      <FormField id="w-to" label="Latest date" error={r?.fields?.latestOn}>{(p) => <Input {...p} type="date" value={f.latestOn} onChange={(e) => setF({ ...f, latestOn: e.target.value })} />}</FormField>
      <fieldset className="sm:col-span-2">
        <legend className="text-sm font-medium">Services</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {services.map((s) => (
            <label key={s.id} className="flex min-h-11 items-center gap-2 rounded-full border border-border px-4 text-sm has-checked:border-primary has-checked:bg-primary-tint">
              <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={f.serviceIds.includes(s.id)} onChange={(e) => setF({ ...f, serviceIds: e.target.checked ? [...f.serviceIds, s.id] : f.serviceIds.filter((x) => x !== s.id) })} /> {s.name}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="sm:col-span-2"><FormField id="w-notes" label="Notes">{(p) => <Textarea {...p} rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} maxLength={1000} />}</FormField></div>
      <div className="flex items-center gap-3 sm:col-span-2">
        <Button type="submit" disabled={pending}>Add to waitlist</Button>
        {r?.error || r?.fields ? <p role="alert" className="text-sm text-danger">{r.error ?? "Please check the highlighted fields."}</p> : r?.ok ? <p role="status" className="text-sm text-success">Added to the waitlist.</p> : null}
      </div>
    </form>
  );
}

export function WaitlistStatus({ slug, id, status }: { slug: string; id: string; status: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const set = (s: "offered" | "booked" | "cancelled") => start(async () => { await setWaitlistStatusAction(slug, { id, status: s }); router.refresh(); });
  return (
    <div className="flex flex-wrap gap-2">
      {status === "waiting" ? <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={() => set("offered")}>Mark offered</Button> : null}
      <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={() => set("booked")}>Mark booked</Button>
      <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => set("cancelled")}>Remove</Button>
    </div>
  );
}
