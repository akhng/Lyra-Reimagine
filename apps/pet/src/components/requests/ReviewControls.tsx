"use client";
import { useActionState, useState } from "react";
import { Button, FormField, Input, Select } from "@lyra/ui";
import { FormStatus } from "@/components/FormBits";
import { reviewRequestAction } from "@/features/requests/actions";

/** Confirm a request with a groomer and time (the database re-checks hours and clashes), or decline it with a reason. */
export function ReviewControls({ slug, requestId, team, defaultDate, defaultTime }: { slug: string; requestId: string; team: Array<{ id: string; name: string }>; defaultDate: string; defaultTime: string }) {
  const [state, action, pending] = useActionState(reviewRequestAction.bind(null, slug, requestId), undefined);
  const [declining, setDeclining] = useState(false);
  if (state?.ok) return <p role="status" className="text-sm font-semibold text-success">Done. The customer can see the update.</p>;
  return (
    <div className="relative z-10 flex flex-col gap-3 border-t border-ink/10 pt-3">
      <FormStatus state={state} />
      {declining ? (
        <form action={action} className="flex flex-col gap-3">
          <input type="hidden" name="action" value="reject" />
          <FormField id={`reason-${requestId}`} label="Reason for the customer (optional)">
            {(p) => <Input {...p} name="reason" maxLength={500} placeholder="e.g. Fully booked that week" />}
          </FormField>
          <div className="flex gap-2">
            <Button type="submit" variant="danger" size="sm" disabled={pending}>
              {pending ? "Declining…" : "Decline request"}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setDeclining(false)}>
              Back
            </Button>
          </div>
        </form>
      ) : (
        <form action={action} className="flex flex-col gap-3">
          <input type="hidden" name="action" value="confirm" />
          <div className="grid gap-3 sm:grid-cols-3">
            <FormField id={`g-${requestId}`} label="Groomer" error={state?.fields?.groomerId}>
              {(p) => (
                <Select {...p} name="groomerId" defaultValue="">
                  <option value="">Choose…</option>
                  {team.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
            <FormField id={`d-${requestId}`} label="Date" error={state?.fields?.date}>
              {(p) => <Input {...p} type="date" name="date" defaultValue={defaultDate} />}
            </FormField>
            <FormField id={`t-${requestId}`} label="Time" error={state?.fields?.time}>
              {(p) => <Input {...p} type="time" name="time" step={900} defaultValue={defaultTime} />}
            </FormField>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Confirming…" : "Confirm appointment"}
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => setDeclining(true)}>
              Decline
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
