"use client";
import { useActionState } from "react";
import { Button, FormField, Select } from "@lyra/ui";
import { AreaField, FormStatus, TextField } from "@/components/FormBits";
import { saveOwnerPetAction } from "@/features/portal/actions";
import type { OwnerPet } from "@/features/portal/queries";
import { SIZES } from "@/features/portal/schemas";

const SIZE_LABEL: Record<(typeof SIZES)[number], string> = { toy: "Toy (under 4 kg)", small: "Small (4–10 kg)", medium: "Medium (10–25 kg)", large: "Large (25–40 kg)", giant: "Giant (over 40 kg)" };

/** Add or edit one of your pets. What you write here is shared with salons you book with. */
export function OwnerPetForm({ pet }: { pet?: OwnerPet }) {
  const [state, action, pending] = useActionState(saveOwnerPetAction.bind(null, pet?.id ?? null), undefined);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormStatus state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="name" label="Name" state={state} defaultValue={pet?.name} required autoComplete="off" />
        <FormField id="f-species" label="Cat or dog?" error={state?.fields?.species}>
          {(p) => (
            <Select {...p} name="species" defaultValue={pet?.species ?? "dog"}>
              <option value="dog">Dog</option>
              <option value="cat">Cat</option>
              <option value="other">Something else</option>
            </Select>
          )}
        </FormField>
        <TextField name="breed" label="Breed" state={state} defaultValue={pet?.breed} autoComplete="off" />
        <FormField id="f-size" label="Size" hint="Salons use size for prices" error={state?.fields?.size}>
          {(p) => (
            <Select {...p} name="size" defaultValue={pet?.size ?? ""}>
              <option value="">Not sure</option>
              {SIZES.map((s) => (
                <option key={s} value={s}>
                  {SIZE_LABEL[s]}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        <TextField name="dateOfBirth" label="Date of birth" type="date" state={state} defaultValue={pet?.dateOfBirth} hint="Or give an estimated age" />
        <TextField name="estimatedAge" label="Estimated age (years)" inputMode="decimal" state={state} defaultValue={pet?.estimatedAge} />
        <TextField name="weightKg" label="Weight (kg)" inputMode="decimal" state={state} defaultValue={pet?.weightKg} />
        <TextField name="coatType" label="Coat" state={state} defaultValue={pet?.coatType} placeholder="e.g. long and silky, double coat" />
      </div>
      <AreaField name="groomingPreferences" label="Grooming preferences" state={state} defaultValue={pet?.groomingPreferences} hint="Favourite cut, products, anything they love" />
      <AreaField name="careNotes" label="Health and handling notes" state={state} defaultValue={pet?.careNotes} hint="Allergies, sensitive spots, nervous with dryers… Shared with salons you book with." />
      <Button type="submit" size="lg" disabled={pending} className="self-start">
        {pending ? "Saving…" : pet ? "Save changes" : "Add pet"}
      </Button>
    </form>
  );
}
