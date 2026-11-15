"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, FormField, Input, Select, Textarea } from "@lyra/ui";
import { rescheduleAppointmentAction, setAppointmentStatusAction, updateAppointmentNotesAction, type ScheduleResult } from "@/features/scheduling/actions";
import { STATUS_LABEL, type AppointmentStatus } from "@/features/scheduling/schemas";

function Message({ r }: { r: ScheduleResult | null }) {
  if (!r) return null;
  if (r.error || r.fields) return <p role="alert" className="text-sm font-medium text-danger">{r.error ?? Object.values(r.fields ?? {})[0]}</p>;
  return <p role="status" className="text-sm text-success">Saved.</p>;
}

/** The next steps for an appointment, limited to what the viewer may do. */
export function StatusButtons({ slug, id, status, allowed }: { slug: string; id: string; status: AppointmentStatus; allowed: AppointmentStatus[] }) {
  const router = useRouter();
  const [r, setR] = useState<ScheduleResult | null>(null);
  const [reason, setReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [pending, start] = useTransition();
  const NEXT: Partial<Record<AppointmentStatus, AppointmentStatus[]>> = { booked: ["confirmed", "checked_in", "no_show"], confirmed: ["checked_in", "no_show"], checked_in: ["in_progress", "completed"], in_progress: ["completed"] };
  const options = (NEXT[status] ?? []).filter((x) => allowed.includes(x));
  const set = (next: AppointmentStatus, why?: string) =>
    start(async () => {
      const res = await setAppointmentStatusAction(slug, { id, status: next, reason: why });
      setR(res);
      if (res.ok) {
        setCancelling(false);
        router.refresh();
      }
    });
  const canCancel = allowed.includes("cancelled") && (status === "booked" || status === "confirmed" || status === "checked_in");
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <Button key={o} type="button" variant={o === "no_show" ? "secondary" : "primary"} disabled={pending} onClick={() => set(o)}>
            Mark {STATUS_LABEL[o].toLowerCase()}
          </Button>
        ))}
        {canCancel && !cancelling ? <Button type="button" variant="ghost" onClick={() => setCancelling(true)}>Cancel appointment</Button> : null}
      </div>
      {cancelling ? (
        <form className="flex flex-col gap-2 rounded-[var(--radius-control)] border border-border p-3" onSubmit={(e) => { e.preventDefault(); set("cancelled", reason); }}>
          <FormField id="cancel-reason" label="Why is it cancelled?" error={r?.fields?.reason}>
            {(p) => <Input {...p} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />}
          </FormField>
          <div className="flex gap-2">
            <Button type="submit" variant="danger" disabled={pending}>Cancel appointment</Button>
            <Button type="button" variant="ghost" onClick={() => setCancelling(false)}>Keep it</Button>
          </div>
        </form>
      ) : null}
      <Message r={r} />
    </div>
  );
}

export function RescheduleForm({ slug, id, date, time, groomerId, groomers }: { slug: string; id: string; date: string; time: string; groomerId: string; groomers: Array<{ id: string; name: string }> }) {
  const router = useRouter();
  const [f, setF] = useState({ date, time, groomerId });
  const [r, setR] = useState<ScheduleResult | null>(null);
  const [pending, start] = useTransition();
  return (
    <form className="grid gap-3 sm:grid-cols-3" onSubmit={(e) => { e.preventDefault(); start(async () => { const res = await rescheduleAppointmentAction(slug, { id, ...f }); setR(res); if (res.ok) router.refresh(); }); }}>
      <FormField id="r-date" label="Date" error={r?.fields?.date}>{(p) => <Input {...p} type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />}</FormField>
      <FormField id="r-time" label="Start time" error={r?.fields?.time}>{(p) => <Input {...p} type="time" step={300} value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} />}</FormField>
      <FormField id="r-groomer" label="Groomer">{(p) => <Select {...p} value={f.groomerId} onChange={(e) => setF({ ...f, groomerId: e.target.value })}>{groomers.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</Select>}</FormField>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
        <Button type="submit" variant="secondary" disabled={pending}>{pending ? "Moving…" : "Move appointment"}</Button>
        <Message r={r} />
      </div>
    </form>
  );
}

export function NotesForm({ slug, id, notes }: { slug: string; id: string; notes: string | null }) {
  const [value, setValue] = useState(notes ?? "");
  const [r, setR] = useState<ScheduleResult | null>(null);
  const [pending, start] = useTransition();
  return (
    <form className="flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); start(async () => setR(await updateAppointmentNotesAction(slug, { id, notes: value }))); }}>
      <FormField id="n-notes" label="Notes for the team">{(p) => <Textarea {...p} rows={3} value={value} onChange={(e) => setValue(e.target.value)} maxLength={2000} />}</FormField>
      <div className="flex items-center gap-3">
        <Button type="submit" variant="secondary" disabled={pending}>Save notes</Button>
        <Message r={r} />
      </div>
    </form>
  );
}
