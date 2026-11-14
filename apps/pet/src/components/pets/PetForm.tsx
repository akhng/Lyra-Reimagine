"use client";
import { useFormAction } from "@/lib/use-form-action";
import Link from "next/link";
import { Button, FormField, Select, buttonVariants } from "@lyra/ui";
import { savePetAction } from "@/features/pets/actions";
import { PET_SIZES } from "@/features/services/pricing";
import { AreaField, FormStatus, Section, TextField } from "../FormBits";

/** Existing values keyed by form field name (camelCase). */
export type PetValues = Partial<Record<string, string | number | null>>;

export function PetForm({ slug, petId, customerId, values = {}, cancelHref }: { slug: string; petId: string | null; customerId: string | null; values?: PetValues; cancelHref: string }) {
  const [state, action, pending] = useFormAction(savePetAction.bind(null, slug, petId, customerId));
  const v = (k: string) => values[k] ?? null;
  const field = (name: string, label: string, extra: Record<string, unknown> = {}) => <TextField name={name} label={label} state={state} defaultValue={v(name)} autoComplete="off" {...extra} />;
  const area = (name: string, label: string, hint?: string) => <AreaField name={name} label={label} state={state} defaultValue={v(name)} hint={hint} rows={2} />;
  return (
    <form onSubmit={action} className="flex flex-col gap-5" noValidate>
      <Section title="About the pet">
        {field("name", "Name", { required: true })}
        <FormField id="f-species" label="Species" error={state?.fields?.species}>
          {(p) => (
            <Select {...p} name="species" defaultValue={String(v("species") ?? "dog")}>
              <option value="dog">Dog</option>
              <option value="cat">Cat</option>
              <option value="other">Other</option>
            </Select>
          )}
        </FormField>
        {field("breed", "Breed", { hint: "Used to match breed pricing." })}
        <FormField id="f-size" label="Size" error={state?.fields?.size} hint="Used to match size pricing.">
          {(p) => (
            <Select {...p} name="size" defaultValue={String(v("size") ?? "")}>
              <option value="">Not set</option>
              {PET_SIZES.map((s) => (
                <option key={s} value={s}>
                  {s[0]!.toUpperCase() + s.slice(1)}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        {field("dateOfBirth", "Date of birth", { type: "date" })}
        {field("estimatedAgeYears", "Or estimated age (years)", { inputMode: "decimal" })}
        <FormField id="f-sex" label="Sex" error={state?.fields?.sex}>
          {(p) => (
            <Select {...p} name="sex" defaultValue={String(v("sex") ?? "unknown")}>
              <option value="unknown">Unknown</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
            </Select>
          )}
        </FormField>
        {field("weightKg", "Weight (kg)", { inputMode: "decimal" })}
        {field("coatType", "Coat type")}
        {field("coatColour", "Coat colour")}
        {field("microchip", "Microchip number")}
        {field("groomIntervalWeeks", "Groom every (weeks)", { inputMode: "numeric", hint: "Used to work out when the next groom is due." })}
      </Section>
      <Section title="Grooming preferences">
        {field("preferredCut", "Preferred cut")}
        {field("coatLength", "Coat length")}
        {field("groomingStyle", "Grooming style")}
        {field("shampoo", "Shampoo")}
        {field("finishingProducts", "Finishing products")}
        {field("nailPreferences", "Nails")}
        {field("earCleaning", "Ear cleaning")}
        {field("noiseSensitivity", "Noise sensitivity", { hint: "e.g. dryer, clippers" })}
        <div className="sm:col-span-2">{area("behaviour", "Behaviour notes")}</div>
        <div className="sm:col-span-2">{area("handlingPreferences", "Handling preferences")}</div>
      </Section>
      <Section title="Care information" description="Shown to the groomer on every visit. Not veterinary advice.">
        {area("allergies", "Allergies")}
        {area("sensitivities", "Sensitivities")}
        {area("skinCoatConcerns", "Skin and coat concerns")}
        {area("handlingPrecautions", "Handling precautions")}
        <div className="sm:col-span-2">{area("medicalNotes", "Medical notes", "Conditions or medication the groomer should know about.")}</div>
        <div className="sm:col-span-2">{field("emergencyContact", "Emergency contact", { hint: "Name and phone, if different from the owner." })}</div>
      </Section>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : petId ? "Save changes" : "Add pet"}
        </Button>
        <Link href={cancelHref} className={buttonVariants({ variant: "ghost" })}>
          Cancel
        </Link>
        <FormStatus state={state} />
      </div>
    </form>
  );
}
