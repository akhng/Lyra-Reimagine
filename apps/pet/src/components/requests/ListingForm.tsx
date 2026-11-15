"use client";
import { useActionState } from "react";
import { Button, FormField, Select } from "@lyra/ui";
import { AreaField, CheckField, FormStatus, TextField } from "@/components/FormBits";
import { saveListingAction } from "@/features/requests/actions";

type Listing = { listed: boolean; accepting_requests: boolean; headline: string | null; about: string | null; suburb: string | null; mascot: string } | null;

/** The salon's Lyra Pet listing: shown to pet owners browsing salons, who then send booking requests. */
export function ListingForm({ slug, listing, canEdit }: { slug: string; listing: Listing; canEdit: boolean }) {
  const [state, action, pending] = useActionState(saveListingAction.bind(null, slug), undefined);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormStatus state={state} saved="Listing saved." />
      <fieldset disabled={!canEdit} className="flex flex-col gap-4">
        <CheckField name="listed" label="List my salon on Lyra Pet" defaultChecked={listing?.listed ?? false} hint="Pet owners can find you, see your online-bookable services and prices, and send requests." />
        <CheckField name="acceptingRequests" label="Accept new booking requests" defaultChecked={listing?.accepting_requests ?? true} hint="Turn off to stay listed while you're fully booked." />
        <TextField name="headline" label="Headline" state={state} defaultValue={listing?.headline} placeholder="e.g. Gentle, fear-free grooming in Fitzroy" />
        <TextField name="suburb" label="Suburb shown to customers" state={state} defaultValue={listing?.suburb} />
        <AreaField name="about" label="About your salon" state={state} defaultValue={listing?.about} rows={4} />
        <FormField id="f-mascot" label="Your listing's mascot">
          {(p) => (
            <Select {...p} name="mascot" defaultValue={listing?.mascot ?? "coco"}>
              <option value="coco">Coco the corgi</option>
              <option value="mochi">Mochi the white cat</option>
              <option value="biscuit">Biscuit the golden retriever</option>
              <option value="luna">Luna the grey cat</option>
            </Select>
          )}
        </FormField>
        <Button type="submit" disabled={pending} className="self-start">
          {pending ? "Saving…" : "Save listing"}
        </Button>
      </fieldset>
    </form>
  );
}
