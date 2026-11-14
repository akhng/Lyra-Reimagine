import type { ReactNode } from "react";
import { FormField, Input, Textarea } from "@lyra/ui";
import type { FormState } from "@/lib/form";

/** The form-level message: an alert for errors, a status for success. */
export function FormStatus({ state, saved }: { state: FormState; saved?: string }) {
  if (state?.error)
    return (
      <p role="alert" className="text-sm font-medium text-danger">
        {state.error}
      </p>
    );
  if (state?.fields && Object.keys(state.fields).length)
    return (
      <p role="alert" className="text-sm font-medium text-danger">
        Please check the highlighted fields.
      </p>
    );
  return state?.ok && saved ? (
    <p role="status" className="text-sm text-success">
      {saved}
    </p>
  ) : null;
}

type FieldProps = { name: string; label: string; state: FormState; defaultValue?: string | number | null; hint?: string; idPrefix?: string };

export function TextField({ name, label, state, defaultValue, hint, idPrefix = "f", ...rest }: FieldProps & { type?: string; inputMode?: "numeric" | "decimal" | "tel" | "email"; required?: boolean; autoComplete?: string; placeholder?: string; max?: string }) {
  return (
    <FormField id={`${idPrefix}-${name}`} label={label} hint={hint} error={state?.fields?.[name]}>
      {(p) => <Input {...p} {...rest} name={name} defaultValue={defaultValue ?? ""} />}
    </FormField>
  );
}

export function AreaField({ name, label, state, defaultValue, hint, idPrefix = "f", rows = 3 }: FieldProps & { rows?: number }) {
  return (
    <FormField id={`${idPrefix}-${name}`} label={label} hint={hint} error={state?.fields?.[name]}>
      {(p) => <Textarea {...p} name={name} rows={rows} defaultValue={defaultValue ?? ""} />}
    </FormField>
  );
}

export function CheckField({ name, label, defaultChecked, hint }: { name: string; label: ReactNode; defaultChecked?: boolean; hint?: string }) {
  return (
    <label className="flex min-h-11 items-start gap-3 text-sm">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-0.5 size-5 shrink-0 accent-[var(--primary)]" />
      <span>
        {label}
        {hint ? <span className="block text-xs text-muted">{hint}</span> : null}
      </span>
    </label>
  );
}

export function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <fieldset className="grid gap-4 rounded-[var(--radius-card)] border border-border bg-surface p-5 shadow-[var(--shadow-card)] sm:grid-cols-2">
      <legend className="sr-only">{title}</legend>
      <div className="sm:col-span-2">
        <h2 className="font-display text-lg font-semibold text-navy">{title}</h2>
        {description ? <p className="text-sm text-muted">{description}</p> : null}
      </div>
      {children}
    </fieldset>
  );
}
