"use client";
import { useFormAction } from "@/lib/use-form-action";
import Link from "next/link";
import { Button, FormField, Select, buttonVariants } from "@lyra/ui";
import { saveCustomerAction } from "@/features/customers/actions";
import { AreaField, CheckField, FormStatus, Section, TextField } from "../FormBits";

type Customer = { id: string; first_name: string; last_name: string | null; preferred_contact: string; preferred_groomer_id: string | null; notes: string | null; is_vip: boolean; marketing_consent: boolean };
type Contact = { email: string | null; mobile: string | null; address_line: string | null; suburb: string | null; state: string | null; postcode: string | null } | null;
const STATES = ["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"];

export function CustomerForm({ slug, customer, contact, groomers }: { slug: string; customer?: Customer; contact?: Contact; groomers: Array<{ id: string; name: string }> }) {
  const [state, action, pending] = useFormAction(saveCustomerAction.bind(null, slug, customer?.id ?? null));
  return (
    <form onSubmit={action} className="flex flex-col gap-5" noValidate>
      <Section title="Customer">
        <TextField name="firstName" label="First name" state={state} defaultValue={customer?.first_name} required autoComplete="off" />
        <TextField name="lastName" label="Last name" state={state} defaultValue={customer?.last_name} autoComplete="off" />
        <FormField id="f-preferredContact" label="Preferred contact" error={state?.fields?.preferredContact}>
          {(p) => (
            <Select {...p} name="preferredContact" defaultValue={customer?.preferred_contact ?? "sms"}>
              <option value="sms">SMS</option>
              <option value="email">Email</option>
              <option value="phone">Phone call</option>
            </Select>
          )}
        </FormField>
        <FormField id="f-preferredGroomerId" label="Preferred groomer" error={state?.fields?.preferredGroomerId}>
          {(p) => (
            <Select {...p} name="preferredGroomerId" defaultValue={customer?.preferred_groomer_id ?? ""}>
              <option value="">No preference</option>
              {groomers.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        <div className="sm:col-span-2">
          <AreaField name="notes" label="Notes" state={state} defaultValue={customer?.notes} hint="Visible to all staff, including groomers." />
        </div>
        <CheckField name="isVip" label="VIP customer" defaultChecked={customer?.is_vip} />
        <CheckField name="marketingConsent" label="Agrees to marketing messages" hint="Only tick this if the customer said yes. We record the date." defaultChecked={customer?.marketing_consent} />
      </Section>
      <Section title="Contact details" description="Only owners, managers and reception can see these.">
        <TextField name="mobile" label="Mobile" type="tel" inputMode="tel" state={state} defaultValue={contact?.mobile} autoComplete="off" />
        <TextField name="email" label="Email" type="email" inputMode="email" state={state} defaultValue={contact?.email} autoComplete="off" />
        <div className="sm:col-span-2">
          <TextField name="addressLine" label="Street address" state={state} defaultValue={contact?.address_line} autoComplete="off" />
        </div>
        <TextField name="suburb" label="Suburb" state={state} defaultValue={contact?.suburb} autoComplete="off" />
        <div className="grid grid-cols-2 gap-4">
          <FormField id="f-state" label="State" error={state?.fields?.state}>
            {(p) => (
              <Select {...p} name="state" defaultValue={contact?.state ?? ""}>
                <option value="">—</option>
                {STATES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </Select>
            )}
          </FormField>
          <TextField name="postcode" label="Postcode" inputMode="numeric" state={state} defaultValue={contact?.postcode} autoComplete="off" />
        </div>
      </Section>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : customer ? "Save changes" : "Add customer"}
        </Button>
        <Link href={customer ? `/b/${slug}/customers/${customer.id}` : `/b/${slug}/customers`} className={buttonVariants({ variant: "ghost" })}>
          Cancel
        </Link>
        <FormStatus state={state} />
      </div>
    </form>
  );
}
