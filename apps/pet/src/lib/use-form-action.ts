"use client";
import { startTransition, useActionState, useEffect, useRef, type FormEvent } from "react";
import type { FormState } from "./form";

/**
 * Like useActionState, but submits via onSubmit so React doesn't reset the
 * form afterwards: on a validation error the user keeps what they typed.
 * `resetOnSuccess` clears "add another" forms once a save succeeds.
 */
export function useFormAction(action: (prev: FormState, form: FormData) => Promise<FormState>, opts: { resetOnSuccess?: boolean } = {}) {
  const [state, dispatch, pending] = useActionState(action, undefined);
  const form = useRef<HTMLFormElement | null>(null);
  useEffect(() => {
    if (opts.resetOnSuccess && state?.ok) form.current?.reset();
  }, [state, opts.resetOnSuccess]);
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    form.current = e.currentTarget;
    const data = new FormData(e.currentTarget);
    startTransition(() => dispatch(data));
  };
  return [state, onSubmit, pending] as const;
}
