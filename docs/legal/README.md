# Legal pages

The published terms and privacy policy are pages in the app, not files here:

| Page | Source |
|---|---|
| Customer Terms (`/terms`) | `apps/pet/src/app/(legal)/terms/page.tsx` |
| Business Terms (`/terms/business`) | `apps/pet/src/app/(legal)/terms/business/page.tsx` |
| Privacy Policy (`/privacy`) | `apps/pet/src/app/(legal)/privacy/page.tsx` |

- The operator's name, ABN, contact email and governing state come from `PLATFORM_LEGAL_NAME`, `PLATFORM_ABN`, `PLATFORM_CONTACT_EMAIL` and `PLATFORM_GOVERNING_STATE`.
- Change `LEGAL_UPDATED` in `apps/pet/src/features/legal/details.ts` with any wording change.
- Keep the privacy policy in step with what the app collects and the service providers it uses.
- Published without lawyer review, at the product owner's decision (2026-11-28).
- The original drafts are in git history (`customer-terms-draft.md`, `business-terms-draft.md`).
