"use client";
import { useActionState, useState } from "react";
import { Button, Card, FormField, Input, Select } from "@lyra/ui";
import { slugify } from "@lyra/platform/tenancy/slug";
import { createBusinessAction } from "@/features/business/actions";
import { AU_TIMEZONES } from "@/features/business/schemas";
import { AgreeNotice } from "./legal/LegalLinks";

/** Business registration: name, booking link, time zone and first location. Creates the tenant atomically. */
export function OnboardingForm() {
  const [state, action, pending] = useActionState(createBusinessAction, undefined);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const shownSlug = slugEdited ? slug : slugify(name);
  return (
    <Card className="p-8">
      <h1 className="font-display text-2xl font-bold">Set up your grooming business</h1>
      <p className="mt-1 text-sm text-muted">You can change these details later in Settings.</p>
      <form action={action} className="mt-6 flex flex-col gap-5" noValidate>
        {state?.error ? (
          <p role="alert" className="rounded-[var(--radius-control)] bg-danger-tint px-3 py-2 text-sm text-danger">
            {state.error}
          </p>
        ) : null}
        <FormField id="name" label="Business name" error={state?.fields?.name}>
          {(p) => <Input {...p} name="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="organization" required />}
        </FormField>
        <FormField id="slug" label="Booking link" hint={`Customers will book at /book/${shownSlug || "your-business"}`} error={state?.fields?.slug}>
          {(p) => (
            <Input
              {...p}
              name="slug"
              value={shownSlug}
              onChange={(e) => {
                setSlugEdited(true);
                setSlug(e.target.value.toLowerCase());
              }}
              autoCapitalize="none"
              spellCheck={false}
              required
            />
          )}
        </FormField>
        <FormField id="timezone" label="Time zone" error={state?.fields?.timezone}>
          {(p) => (
            <Select {...p} name="timezone" defaultValue="Australia/Melbourne">
              {AU_TIMEZONES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        <FormField id="locationName" label="First location" hint="For example your salon's suburb, or “Mobile van”." error={state?.fields?.locationName}>
          {(p) => <Input {...p} name="locationName" placeholder="Main location" />}
        </FormField>
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Setting up…" : "Create business"}
        </Button>
        <AgreeNotice action="creating a business" business />
      </form>
    </Card>
  );
}
