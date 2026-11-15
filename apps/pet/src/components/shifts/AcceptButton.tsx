"use client";
import { Check } from "lucide-react";
import { useState, useTransition } from "react";
import { Button, FormField, Select } from "@lyra/ui";
import { acceptRequestAction } from "@/features/shifts/actions";

/**
 * Accept a request from the shift board. For flexible requests the groomer
 * picks one of the customer's times that fits their own hours. If someone
 * else got there first, the database says so and the card explains.
 */
export function AcceptButton({ slug, requestId, fixed, starts, tz }: { slug: string; requestId: string; fixed: boolean; starts: string[]; tz: string }) {
  const [start, setStart] = useState(starts[0] ?? "");
  const [result, setResult] = useState<{ ok: boolean; error?: string } | null>(null);
  const [pending, run] = useTransition();
  const label = (iso: string) => new Intl.DateTimeFormat("en-AU", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: tz }).format(new Date(iso));
  if (result?.ok)
    return (
      <p role="status" className="animate-pop inline-flex items-center gap-2 rounded-full bg-mint-tint px-4 py-2 text-sm font-bold text-success">
        <Check className="size-4" aria-hidden /> It&apos;s yours! Added to your calendar.
      </p>
    );
  if (!starts.length) return <p className="text-sm font-semibold text-muted">None of the offered times fit your hours.</p>;
  return (
    <div className="relative z-10 flex flex-col gap-2">
      {!fixed ? (
        <FormField id={`start-${requestId}`} label="Choose a time">
          {(p) => (
            <Select {...p} value={start} onChange={(e) => setStart(e.target.value)}>
              {starts.map((s) => (
                <option key={s} value={s}>
                  {label(s)}
                </option>
              ))}
            </Select>
          )}
        </FormField>
      ) : null}
      {result?.error ? (
        <p role="alert" className="text-sm font-semibold text-danger">
          {result.error}
        </p>
      ) : null}
      <Button type="button" size="lg" disabled={pending} onClick={() => run(async () => setResult(await acceptRequestAction(slug, requestId, fixed ? null : start)))}>
        {pending ? "Accepting…" : "Accept appointment"}
      </Button>
    </div>
  );
}
