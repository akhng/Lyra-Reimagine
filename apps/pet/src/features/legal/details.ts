import "server-only";
import { serverEnv } from "@lyra/platform/env";

/** When the published terms and privacy policy last changed. Update with any wording change. */
export const LEGAL_UPDATED = "28 November 2026";

/** Who operates Lyra Pet and how to reach them, from the environment (no placeholders in the published pages). */
export function legalDetails() {
  const env = serverEnv();
  const name = env.PLATFORM_LEGAL_NAME ?? null;
  const abn = env.PLATFORM_ABN ?? null;
  return {
    name,
    abn,
    email: env.PLATFORM_CONTACT_EMAIL ?? null,
    state: env.PLATFORM_GOVERNING_STATE,
    /** "Example Pty Ltd (ABN 12 345 678 901)", or a neutral description until the details are set. */
    operator: name ? `${name}${abn ? ` (ABN ${abn})` : ""}` : "the operator of Lyra Pet",
  };
}
