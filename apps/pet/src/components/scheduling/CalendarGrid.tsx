"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cn } from "@lyra/ui";
import { moveAppointmentAction } from "@/features/scheduling/actions";
import { STATUS_LABEL, type AppointmentStatus } from "@/features/scheduling/schemas";
import { fromLocal, minutesToHhmm } from "@/features/scheduling/time";

export type GridAppointment = { id: string; columnKey: string; groomerId: string; date: string; startMin: number; serviceEndMin: number; blockEndMin: number; status: AppointmentStatus; title: string; detail: string; online: boolean };
export type GridColumn = { key: string; label: string; date: string; groomerId: string; workingWindows: Array<[number, number]> };

const SLOT = 15;
const PX_PER_MIN = 1.2;

/**
 * Time grid for the calendar (day view: a column per groomer; week view: a
 * column per day). Desktop: drag an appointment to another time or column
 * to reschedule; the database refuses clashes. Everything is also a link,
 * and the appointment page has a keyboard-friendly reschedule form.
 */
export function CalendarGrid({ slug, timeZone, columns, appointments, startMin, endMin, canMove }: { slug: string; timeZone: string; columns: GridColumn[]; appointments: GridAppointment[]; startMin: number; endMin: number; canMove: boolean }) {
  const router = useRouter();
  const [dragging, setDragging] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "error" | "ok"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const height = (endMin - startMin) * PX_PER_MIN;
  const hours: number[] = [];
  for (let m = Math.ceil(startMin / 60) * 60; m < endMin; m += 60) hours.push(m);

  function drop(col: GridColumn, e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    const a = appointments.find((x) => x.id === id);
    setDragging(null);
    if (!a) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const offset = Number(e.dataTransfer.getData("application/x-offset") || 0);
    const raw = startMin + (e.clientY - rect.top - offset) / PX_PER_MIN;
    const minute = Math.max(startMin, Math.round(raw / SLOT) * SLOT);
    if (minute === a.startMin && col.groomerId === a.groomerId && col.date === a.date) return;
    start(async () => {
      const r = await moveAppointmentAction(slug, { id, startsAt: new Date(fromLocal(col.date, minute, timeZone)).toISOString(), groomerId: col.groomerId });
      setMessage(r.ok ? { tone: "ok", text: `Moved to ${minutesToHhmm(minute)}${col.groomerId !== a.groomerId ? ` with ${col.label}` : ""}.` } : { tone: "error", text: r.error ?? "That move didn't work." });
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <p role={message?.tone === "error" ? "alert" : "status"} aria-live="polite" className={cn("min-h-5 text-sm", message?.tone === "error" ? "text-danger" : "text-success")}>
        {pending ? "Moving…" : message?.text}
      </p>
      <div className="overflow-x-auto rounded-[var(--radius-card)] border border-border bg-surface">
        <div className="grid min-w-[40rem]" style={{ gridTemplateColumns: `4rem repeat(${columns.length}, minmax(9rem, 1fr))` }}>
          <div className="sticky left-0 z-10 border-b border-border bg-surface" />
          {columns.map((c) => (
            <div key={c.key} className="border-b border-l border-border px-2 py-2 text-sm font-semibold text-ink">
              {c.label}
            </div>
          ))}
          <div className="relative sticky left-0 z-10 bg-surface" style={{ height }}>
            {hours.map((m) => (
              <span key={m} className="absolute right-2 -translate-y-1/2 text-xs text-muted tabular" style={{ top: (m - startMin) * PX_PER_MIN }}>
                {minutesToHhmm(m)}
              </span>
            ))}
          </div>
          {columns.map((c) => (
            <div
              key={c.key}
              className={cn("relative border-l border-border", dragging && "bg-primary-tint/30")}
              style={{ height }}
              onDragOver={canMove ? (e) => e.preventDefault() : undefined}
              onDrop={canMove ? (e) => drop(c, e) : undefined}
              data-testid={`column-${c.key}`}
            >
              {/* Shade time outside the groomer's hours. */}
              <div className="absolute inset-0 bg-surface-2" aria-hidden />
              {c.workingWindows.map(([s, e]) => (
                <div key={`${s}-${e}`} className="absolute inset-x-0 bg-surface" style={{ top: (Math.max(s, startMin) - startMin) * PX_PER_MIN, height: (Math.min(e, endMin) - Math.max(s, startMin)) * PX_PER_MIN }} aria-hidden />
              ))}
              {hours.map((m) => (
                <div key={m} className="absolute inset-x-0 border-t border-border/60" style={{ top: (m - startMin) * PX_PER_MIN }} aria-hidden />
              ))}
              {appointments
                .filter((a) => a.columnKey === c.key)
                .map((a) => (
                  <Link
                    key={a.id}
                    href={`/b/${slug}/appointments/${a.id}`}
                    draggable={canMove && !["completed", "cancelled", "no_show"].includes(a.status)}
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", a.id);
                      e.dataTransfer.setData("application/x-offset", String(e.clientY - e.currentTarget.getBoundingClientRect().top));
                      setDragging(a.id);
                    }}
                    onDragEnd={() => setDragging(null)}
                    className={cn(
                      "absolute inset-x-1 overflow-hidden rounded-lg border-l-4 px-2 py-1 text-xs shadow-sm transition-shadow hover:shadow-md focus-visible:z-20",
                      a.status === "completed" ? "border-success bg-success-tint" : a.status === "in_progress" || a.status === "checked_in" ? "border-warning bg-warning-tint" : "border-primary bg-primary-tint",
                      dragging === a.id && "opacity-60",
                    )}
                    style={{ top: (a.startMin - startMin) * PX_PER_MIN, height: Math.max(22, (a.serviceEndMin - a.startMin) * PX_PER_MIN) }}
                    aria-label={`${minutesToHhmm(a.startMin)}–${minutesToHhmm(a.serviceEndMin)} ${a.title}, ${STATUS_LABEL[a.status]}${a.online ? ", booked online" : ""}`}
                  >
                    <span className="block font-semibold text-text tabular">
                      {minutesToHhmm(a.startMin)} {a.title}
                    </span>
                    <span className="block truncate text-muted">{a.detail}</span>
                  </Link>
                ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
