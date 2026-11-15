"use client";
import { useState, useTransition } from "react";
import { Button, Select } from "@lyra/ui";
import { cancelByTokenAction, rescheduleByTokenAction } from "@/features/booking/actions";
import type { OnlineContext } from "@/features/booking/context";
import { availability } from "@/features/scheduling/availability";
import { addDays, localToday } from "@/features/scheduling/time";
import { SlotPicker } from "./SlotPicker";

/** Cancel or move a booking from its private link (within the salon's cancellation window). */
export function ManageBooking({ token, ctx, booking, nowMs }: { token: string; ctx: OnlineContext | null; booking: { locationId: string; groomerId: string; blockMinutes: number; groomer: string }; nowMs: number }) {
  const [mode, setMode] = useState<"idle" | "move" | "cancel">("idle");
  const [groomer, setGroomer] = useState(booking.groomerId);
  const [date, setDate] = useState<string | null>(null);
  const [startsAt, setStartsAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const location = ctx?.locations.find((l) => l.id === booking.locationId);
  const tz = location?.timezone ?? ctx?.business.timezone ?? "Australia/Melbourne";
  const today = localToday(tz, new Date(nowMs));
  const days = ctx && location && mode === "move"
    ? availability({ timeZone: tz, locationId: location.id, locationHours: location.hours, staffHours: ctx.staffHours, busy: ctx.busy, closures: ctx.closures, policy: ctx.policy, durationMinutes: booking.blockMinutes, bufferMinutes: 0, groomerId: groomer || null, from: today, to: addDays(today, Math.min(ctx.policy.maxDaysAhead, 28)), now: new Date(nowMs) })
    : [];
  return (
    <div className="flex flex-col gap-4">
      {mode === "idle" ? (
        <div className="flex flex-wrap gap-2">
          {ctx ? <Button type="button" onClick={() => setMode("move")}>Change time</Button> : null}
          <Button type="button" variant="secondary" onClick={() => setMode("cancel")}>Cancel booking</Button>
        </div>
      ) : null}
      {mode === "cancel" ? (
        <div className="flex flex-col gap-3 rounded-[var(--radius-control)] border border-border p-4">
          <p className="text-sm">Cancel this appointment? The salon will see the cancellation straight away.</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="danger" disabled={pending} onClick={() => start(async () => { const r = await cancelByTokenAction(token); if (r?.error) setError(r.error); })}>Yes, cancel it</Button>
            <Button type="button" variant="ghost" onClick={() => setMode("idle")}>Keep it</Button>
          </div>
        </div>
      ) : null}
      {mode === "move" && ctx ? (
        <div className="flex flex-col gap-3 rounded-[var(--radius-control)] border border-border p-4">
          <label className="flex flex-col gap-1.5 text-sm font-medium sm:max-w-xs">
            Groomer
            <Select value={groomer} onChange={(e) => { setGroomer(e.target.value); setStartsAt(null); setDate(null); }}>
              <option value={booking.groomerId}>{booking.groomer} (same as now)</option>
              <option value="">Any groomer</option>
            </Select>
          </label>
          <SlotPicker days={days} date={date} startsAt={startsAt} onDate={(x) => { setDate(x); setStartsAt(null); }} onTime={(iso) => setStartsAt(iso)} />
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={!startsAt || pending} onClick={() => startsAt && start(async () => { const r = await rescheduleByTokenAction(token, startsAt, groomer || null); if (r?.error) setError(r.error); })}>{pending ? "Moving…" : "Move to this time"}</Button>
            <Button type="button" variant="ghost" onClick={() => setMode("idle")}>Back</Button>
          </div>
        </div>
      ) : null}
      {error ? <p role="alert" className="text-sm font-medium text-danger">{error}</p> : null}
    </div>
  );
}
