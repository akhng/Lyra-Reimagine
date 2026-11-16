"use client";
import { Star } from "lucide-react";
import { useActionState, useState } from "react";
import { Button, cn, FormField, Textarea } from "@lyra/ui";
import { FormStatus } from "@/components/FormBits";
import { submitReviewAction } from "@/features/loyalty/actions";

/** Rate and review a completed groom (once). */
export function ReviewForm({ appointmentId, petName }: { appointmentId: string; petName: string }) {
  const [state, action, pending] = useActionState(submitReviewAction.bind(null, appointmentId), undefined);
  const [rating, setRating] = useState(0);
  if (state?.ok) return <p role="status" className="animate-pop rounded-full bg-mint-tint px-4 py-2 text-sm font-bold text-success">Thank you! Your review helps other pet owners.</p>;
  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      <FormStatus state={state} />
      <fieldset>
        <legend className="mb-1.5 text-sm font-semibold text-ink">How was {petName}&apos;s groom?</legend>
        <input type="hidden" name="rating" value={rating || ""} />
        <div role="radiogroup" aria-label="Rating" className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n === 1 ? "" : "s"}`} onClick={() => setRating(n)} className="grid size-11 place-items-center rounded-full transition-transform duration-150 hover:scale-110">
              <Star className={cn("size-8", n <= rating ? "fill-butter text-warning" : "text-border")} aria-hidden />
            </button>
          ))}
        </div>
        {state?.fields?.rating ? <p className="mt-1 text-xs font-semibold text-danger">{state.fields.rating}</p> : null}
      </fieldset>
      <FormField id={`review-${appointmentId}`} label="Comments (optional)">
        {(p) => <Textarea {...p} name="comment" maxLength={1000} rows={3} />}
      </FormField>
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Sending…" : "Send review"}
      </Button>
    </form>
  );
}
