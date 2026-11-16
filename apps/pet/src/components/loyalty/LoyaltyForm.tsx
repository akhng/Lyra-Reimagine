"use client";
import { useActionState } from "react";
import { Button } from "@lyra/ui";
import { CheckField, FormStatus, TextField } from "@/components/FormBits";
import { saveLoyaltyAction } from "@/features/loyalty/actions";
import type { LoyaltySettings } from "@/features/loyalty/queries";

/** Loyalty rules: points per completed appointment and per dollar, pet birthday points, and the on/off switches. */
export function LoyaltyForm({ slug, settings, canEdit }: { slug: string; settings: LoyaltySettings; canEdit: boolean }) {
  const [state, action, pending] = useActionState(saveLoyaltyAction.bind(null, slug), undefined);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormStatus state={state} saved="Loyalty rules saved." />
      <fieldset disabled={!canEdit} className="flex flex-col gap-4">
        <CheckField name="enabled" label="Customers earn loyalty points" defaultChecked={settings.enabled} hint="Points are added when an appointment is completed. Never for just sending a request." />
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField name="perAppointment" label="Points per completed appointment" inputMode="numeric" state={state} defaultValue={settings.perAppointment} />
          <TextField name="perDollar" label="Points per $1 of the price" inputMode="decimal" state={state} defaultValue={settings.perDollar} />
          <TextField name="birthday" label="Pet birthday points" inputMode="numeric" state={state} defaultValue={settings.birthday} hint="Once a year, if the birthday is on the pet's profile." />
        </div>
        <CheckField name="achievements" label="Achievements and milestones" defaultChecked={settings.achievements} hint="Pet grooming milestones for customers and business achievements for your team." />
        <Button type="submit" disabled={pending} className="self-start">
          {pending ? "Saving…" : "Save loyalty rules"}
        </Button>
      </fieldset>
    </form>
  );
}
