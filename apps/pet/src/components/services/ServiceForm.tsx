"use client";
import { useFormAction } from "@/lib/use-form-action";
import { Button } from "@lyra/ui";
import { saveServiceAction } from "@/features/services/actions";
import { COAT_CONDITIONS, PET_SIZES } from "@/features/services/pricing";
import type { ServiceWithRules } from "@/features/services/queries";
import { AreaField, CheckField, FormStatus, TextField } from "../FormBits";

export const COAT_LABELS: Record<string, string> = { matted: "Matted coat", heavily_matted: "Heavily matted", double_coat_deshed: "Double-coat de-shed", flea_treatment: "Flea treatment" };
const dollars = (cents: number | undefined) => (cents === undefined ? "" : (cents / 100).toFixed(2).replace(/\.00$/, ""));

export function ServiceForm({ slug, service, idPrefix }: { slug: string; service?: ServiceWithRules; idPrefix: string }) {
  const [state, action, pending] = useFormAction(saveServiceAction.bind(null, slug, service?.id ?? null), { resetOnSuccess: !service });
  const rule = (kind: string, match: string) => service?.service_price_rules.find((r) => r.kind === kind && r.match_value === match)?.price_cents;
  const breeds = (service?.service_price_rules ?? []).filter((r) => r.kind === "breed").map((r) => `${r.match_value}: ${dollars(r.price_cents)}`).join("\n");
  const p = { state, idPrefix };
  return (
    <form onSubmit={action} className="grid gap-4 sm:grid-cols-2" noValidate>
      <TextField {...p} name="name" label="Service name" defaultValue={service?.name} required />
      <TextField {...p} name="category" label="Category" defaultValue={service?.category} hint="e.g. Full groom, Bath, Add-on" />
      <div className="sm:col-span-2">
        <AreaField {...p} name="description" label="Description" defaultValue={service?.description} rows={2} />
      </div>
      <TextField {...p} name="durationMinutes" label="Duration (minutes)" inputMode="numeric" defaultValue={service?.duration_minutes ?? 60} />
      <TextField {...p} name="bufferMinutes" label="Clean-up buffer (minutes)" inputMode="numeric" defaultValue={service?.buffer_minutes ?? 0} />
      <TextField {...p} name="basePrice" label="Base price (A$, incl. GST)" inputMode="decimal" defaultValue={dollars(service?.base_price_cents)} />
      <div className="flex flex-col justify-end gap-1">
        <CheckField name="priceFrom" label="Show as “from” price" defaultChecked={service?.price_from} />
        <CheckField name="bookableOnline" label="Customers can book online" defaultChecked={service?.bookable_online} />
        {service ? <CheckField name="active" label="Active" defaultChecked={service.active} /> : null}
      </div>
      <fieldset className="grid gap-3 sm:col-span-2 sm:grid-cols-5">
        <legend className="mb-2 text-sm font-medium">Price by size (optional, replaces the base price)</legend>
        {PET_SIZES.map((s) => (
          <TextField key={s} {...p} name={`size_${s}`} label={s[0]!.toUpperCase() + s.slice(1)} inputMode="decimal" defaultValue={dollars(rule("size", s))} />
        ))}
      </fieldset>
      <fieldset className="grid gap-3 sm:col-span-2 sm:grid-cols-4">
        <legend className="mb-2 text-sm font-medium">Coat condition surcharges (optional, added on top)</legend>
        {COAT_CONDITIONS.map((c) => (
          <TextField key={c} {...p} name={`coat_${c}`} label={COAT_LABELS[c] ?? c} inputMode="decimal" defaultValue={dollars(rule("coat_condition", c))} />
        ))}
      </fieldset>
      <div className="sm:col-span-2">
        <AreaField {...p} name="breedPrices" label="Price by breed (optional, beats size)" hint="One per line, like “Golden Retriever: 130”." defaultValue={breeds} rows={3} />
      </div>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : service ? "Save service" : "Add service"}
        </Button>
        <FormStatus state={state} saved="Service saved." />
      </div>
    </form>
  );
}
