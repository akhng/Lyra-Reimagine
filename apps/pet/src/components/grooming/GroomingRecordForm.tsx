"use client";
import { ImagePlus, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Button, FormField, Select, buttonVariants } from "@lyra/ui";
import { attachGroomingPhotosAction, createGroomingRecordAction } from "@/features/grooming/actions";
import type { FormState } from "@/lib/form";
import { PHOTO_ACCEPT, photoProblem, uploadPhoto } from "@/lib/upload";
import { AreaField, FormStatus, Section, TextField } from "../FormBits";

type Pick = { file: File; preview: string };
type Kind = "before" | "after";

function PhotoPicker({ kind, picks, onAdd, onRemove, disabled }: { kind: Kind; picks: Pick[]; onAdd: (files: File[]) => void; onRemove: (i: number) => void; disabled: boolean }) {
  const label = kind === "before" ? "Before photos" : "After photos";
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">{label}</p>
      <ul className="flex flex-wrap gap-2" aria-label={label}>
        {picks.map((p, i) => (
          <li key={p.preview} className="relative">
            {/* Local preview (blob URL) of a file not yet uploaded. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.preview} alt={`${label} ${i + 1}`} className="size-24 rounded-[var(--radius-control)] object-cover" />
            <button type="button" onClick={() => onRemove(i)} disabled={disabled} className="absolute -top-2 -right-2 grid size-8 place-items-center rounded-full bg-navy text-white" aria-label={`Remove ${label.toLowerCase()} ${i + 1}`}>
              <X className="size-4" aria-hidden />
            </button>
          </li>
        ))}
        <li>
          <label className="grid size-24 cursor-pointer place-items-center rounded-[var(--radius-control)] border border-dashed border-border bg-surface-2 text-muted hover:text-primary-text focus-within:ring-2 focus-within:ring-primary/30">
            <span className="flex flex-col items-center gap-1 text-xs">
              <ImagePlus className="size-5" aria-hidden /> Add
            </span>
            <input type="file" accept={PHOTO_ACCEPT} multiple className="sr-only" disabled={disabled} aria-label={`Add ${label.toLowerCase()}`} onChange={(e) => { onAdd([...(e.target.files ?? [])]); e.target.value = ""; }} />
          </label>
        </li>
      </ul>
    </div>
  );
}

/**
 * Record a groom: save the record, upload photos straight to private
 * storage under it, then register them. If photo upload fails the record
 * is kept and the user is told, so notes are never lost.
 */
export function GroomingRecordForm({ slug, businessId, petId, today, groomers, defaultGroomerId, services, appointmentId = null, preselectedServiceIds = [], defaultDate }: { slug: string; businessId: string; petId: string; today: string; groomers: Array<{ id: string; name: string }>; defaultGroomerId: string | null; services: Array<{ id: string; name: string }>; appointmentId?: string | null; preselectedServiceIds?: string[]; defaultDate?: string }) {
  const router = useRouter();
  const [state, setState] = useState<FormState>(undefined);
  const [busy, setBusy] = useState<string | null>(null);
  const [photos, setPhotos] = useState<Record<Kind, Pick[]>>({ before: [], after: [] });
  const [photoError, setPhotoError] = useState<string | null>(null);

  useEffect(() => () => [...photos.before, ...photos.after].forEach((p) => URL.revokeObjectURL(p.preview)), [photos]);

  const add = (kind: Kind) => (files: File[]) => {
    const problems = files.map(photoProblem).filter(Boolean);
    setPhotoError(problems.length ? problems.join(" ") : null);
    const ok = files.filter((f) => !photoProblem(f)).map((file) => ({ file, preview: URL.createObjectURL(file) }));
    setPhotos((p) => ({ ...p, [kind]: [...p[kind], ...ok].slice(0, 6) }));
  };
  const remove = (kind: Kind) => (i: number) => setPhotos((p) => ({ ...p, [kind]: p[kind].filter((_, j) => j !== i) }));

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const get = (k: string) => String(form.get(k) ?? "");
    setBusy("Saving…");
    const result = await createGroomingRecordAction(slug, {
      petId, groomedOn: get("groomedOn"), groomerId: get("groomerId"), serviceIds: form.getAll("serviceIds").map(String), durationMinutes: get("durationMinutes"),
      haircut: get("haircut"), shampoo: get("shampoo"), customerInstructions: get("customerInstructions"), observations: get("observations"), customerFeedback: get("customerFeedback"),
      appointmentId,
    });
    if (!result?.ok || !result.id) {
      setState(result);
      setBusy(null);
      return;
    }
    const recordId = result.id;
    const all = [...photos.before.map((p) => ({ ...p, kind: "before" as const })), ...photos.after.map((p) => ({ ...p, kind: "after" as const }))];
    if (all.length) {
      setBusy(`Uploading ${all.length} photo${all.length === 1 ? "" : "s"}…`);
      const uploaded = await Promise.all(all.map(async (p) => ({ kind: p.kind, path: await uploadPhoto(`${businessId}/grooming/${recordId}`, p.file) })));
      const good = uploaded.flatMap((u) => (u.path ? [{ kind: u.kind, path: u.path }] : []));
      const attached = good.length ? (await attachGroomingPhotosAction(slug, recordId, good)).ok : true;
      if (!attached || good.length < all.length) {
        setBusy(null);
        router.push(`/b/${slug}/pets/${petId}?photos=partial`);
        return;
      }
    }
    router.push(`/b/${slug}/pets/${petId}?saved=groom`);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <Section title="The groom">
        <TextField name="groomedOn" label="Date" type="date" state={state} defaultValue={defaultDate ?? today} max={today} required />
        <FormField id="f-groomerId" label="Groomer" error={state?.fields?.groomerId}>
          {(p) => (
            <Select {...p} name="groomerId" defaultValue={defaultGroomerId ?? ""}>
              <option value="">Not recorded</option>
              {groomers.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        <fieldset className="sm:col-span-2">
          <legend className="text-sm font-medium">Services</legend>
          {services.length ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {services.map((s) => (
                <label key={s.id} className="flex min-h-11 items-center gap-2 rounded-full border border-border px-4 text-sm has-checked:border-primary has-checked:bg-primary-tint">
                  <input type="checkbox" name="serviceIds" value={s.id} defaultChecked={preselectedServiceIds.includes(s.id)} className="size-4 accent-[var(--primary)]" /> {s.name}
                </label>
              ))}
            </div>
          ) : (
            <p className="mt-1 text-sm text-muted">
              No services yet. <Link href={`/b/${slug}/services`} className="text-primary-text underline">Add your services</Link> to tag grooms with them.
            </p>
          )}
          {state?.fields?.serviceIds ? <p className="mt-1 text-xs font-medium text-danger">{state.fields.serviceIds}</p> : null}
        </fieldset>
        <TextField name="durationMinutes" label="Time taken (minutes)" inputMode="numeric" state={state} />
        <TextField name="haircut" label="Haircut / blade" state={state} />
        <TextField name="shampoo" label="Shampoo used" state={state} />
        <div className="sm:col-span-2">
          <AreaField name="customerInstructions" label="Customer's instructions" state={state} rows={2} />
        </div>
        <div className="sm:col-span-2">
          <AreaField name="observations" label="Groomer observations" state={state} rows={2} hint="Skin, coat, behaviour, anything to check next time." />
        </div>
        <div className="sm:col-span-2">
          <AreaField name="customerFeedback" label="Customer feedback" state={state} rows={2} />
        </div>
      </Section>
      <Section title="Photos" description="JPEG, PNG or WebP, up to 8 MB each. Stored privately for your business.">
        <PhotoPicker kind="before" picks={photos.before} onAdd={add("before")} onRemove={remove("before")} disabled={!!busy} />
        <PhotoPicker kind="after" picks={photos.after} onAdd={add("after")} onRemove={remove("after")} disabled={!!busy} />
        {photoError ? (
          <p role="alert" className="text-sm text-danger sm:col-span-2">
            {photoError}
          </p>
        ) : null}
      </Section>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={!!busy}>
          {busy ?? "Save grooming record"}
        </Button>
        <Link href={`/b/${slug}/pets/${petId}`} className={buttonVariants({ variant: "ghost" })}>
          Cancel
        </Link>
        <span aria-live="polite" className="sr-only">
          {busy}
        </span>
        <FormStatus state={state} />
      </div>
    </form>
  );
}
