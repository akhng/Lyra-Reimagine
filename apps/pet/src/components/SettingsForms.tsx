"use client";
import { useFormAction } from "@/lib/use-form-action";
import { Button, FormField, Input, Select } from "@lyra/ui";
import { saveLocationAction, updateBusinessAction, type FormState } from "@/features/business/actions";
import { AU_TIMEZONES } from "@/features/business/schemas";

function Status({ state, saved }: { state: FormState; saved: string }) {
  if (state?.error)
    return (
      <p role="alert" className="text-sm text-danger">
        {state.error}
      </p>
    );
  return state?.ok ? (
    <p role="status" className="text-sm text-success">
      {saved}
    </p>
  ) : null;
}

type Business = { name: string; timezone: string; abn: string | null; gstRegistered: boolean; phone: string | null; email: string | null };

export function BusinessDetailsForm({ slug, business, canEdit }: { slug: string; business: Business; canEdit: boolean }) {
  const [state, action, pending] = useFormAction(updateBusinessAction.bind(null, slug));
  return (
    <form onSubmit={action} className="grid gap-4 sm:grid-cols-2" noValidate>
      <fieldset disabled={!canEdit} className="contents">
        <FormField id="name" label="Business name" error={state?.fields?.name}>
          {(p) => <Input {...p} name="name" defaultValue={business.name} required />}
        </FormField>
        <FormField id="timezone" label="Time zone" error={state?.fields?.timezone}>
          {(p) => (
            <Select {...p} name="timezone" defaultValue={business.timezone}>
              {AU_TIMEZONES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        <FormField id="abn" label="ABN" hint="11 digits. Shown on tax invoices." error={state?.fields?.abn}>
          {(p) => <Input {...p} name="abn" inputMode="numeric" defaultValue={business.abn ?? ""} />}
        </FormField>
        <FormField id="phone" label="Phone" error={state?.fields?.phone}>
          {(p) => <Input {...p} name="phone" type="tel" defaultValue={business.phone ?? ""} />}
        </FormField>
        <FormField id="email" label="Business email" error={state?.fields?.email}>
          {(p) => <Input {...p} name="email" type="email" defaultValue={business.email ?? ""} />}
        </FormField>
        <label className="flex items-center gap-2 self-end pb-3 text-sm">
          <input type="checkbox" name="gstRegistered" defaultChecked={business.gstRegistered} className="size-4 accent-[var(--primary)]" /> Registered for GST
        </label>
      </fieldset>
      {canEdit ? (
        <div className="flex items-center gap-3 sm:col-span-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save details"}
          </Button>
          <Status state={state} saved="Details saved." />
        </div>
      ) : (
        <p className="text-sm text-muted sm:col-span-2">Only owners and managers can change these details.</p>
      )}
    </form>
  );
}

type Location = { id?: string; name: string; addressLine: string | null; suburb: string | null; state: string | null; postcode: string | null; isMobile: boolean };
const STATES = ["", "NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"];

export function LocationForm({ slug, location, idPrefix }: { slug: string; location?: Location; idPrefix: string }) {
  const [state, action, pending] = useFormAction(saveLocationAction.bind(null, slug), { resetOnSuccess: !location?.id });
  const f = (n: string) => `${idPrefix}-${n}`;
  return (
    <form onSubmit={action} className="grid gap-3 sm:grid-cols-6" noValidate>
      {location?.id ? <input type="hidden" name="id" value={location.id} /> : null}
      <div className="sm:col-span-2">
        <FormField id={f("name")} label="Name" error={state?.fields?.name}>
          {(p) => <Input {...p} name="name" defaultValue={location?.name ?? ""} required />}
        </FormField>
      </div>
      <div className="sm:col-span-4">
        <FormField id={f("address")} label="Street address" error={state?.fields?.addressLine}>
          {(p) => <Input {...p} name="addressLine" defaultValue={location?.addressLine ?? ""} autoComplete="street-address" />}
        </FormField>
      </div>
      <div className="sm:col-span-3">
        <FormField id={f("suburb")} label="Suburb" error={state?.fields?.suburb}>
          {(p) => <Input {...p} name="suburb" defaultValue={location?.suburb ?? ""} />}
        </FormField>
      </div>
      <div className="sm:col-span-1">
        <FormField id={f("state")} label="State" error={state?.fields?.state}>
          {(p) => (
            <Select {...p} name="state" defaultValue={location?.state ?? ""}>
              {STATES.map((s) => (
                <option key={s} value={s}>
                  {s || "—"}
                </option>
              ))}
            </Select>
          )}
        </FormField>
      </div>
      <div className="sm:col-span-2">
        <FormField id={f("postcode")} label="Postcode" error={state?.fields?.postcode}>
          {(p) => <Input {...p} name="postcode" inputMode="numeric" defaultValue={location?.postcode ?? ""} />}
        </FormField>
      </div>
      <label className="flex items-center gap-2 text-sm sm:col-span-6">
        <input type="checkbox" name="isMobile" defaultChecked={location?.isMobile ?? false} className="size-4 accent-[var(--primary)]" /> Mobile grooming (we travel to customers)
      </label>
      <div className="flex items-center gap-3 sm:col-span-6">
        <Button type="submit" variant={location?.id ? "secondary" : "primary"} disabled={pending}>
          {pending ? "Saving…" : location?.id ? "Save location" : "Add location"}
        </Button>
        <Status state={state} saved="Location saved." />
      </div>
    </form>
  );
}
