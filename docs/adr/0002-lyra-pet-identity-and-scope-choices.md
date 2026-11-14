# ADR 0002 — Lyra Pet identity and early scope choices

**Status:** Accepted (2026-11-15)

## Decisions

- **Identity:** navy, teal and warm neutrals; Plus Jakarta Sans (display) and Inter (UI); rounded cards with subtle shadows. Premium and friendly, inspired by Linear/Stripe-style clarity; not childish, not a generic admin template. Teal `#0B7A75` keeps white text at 5.2:1 (AA).
- **Language:** Australian English only for now (the brief targets Australian businesses). Copy lives in components; an i18n layer can be added when a second language is needed.
- **Tenant URLs:** staff pages live under `/b/<slug>`; the public booking portal will be `/book/<slug>` on the same app (a custom domain such as lyrapet.com can point at it later).
- **Roles from day one:** owner, manager, receptionist, groomer, enforced in the database and mirrored in `roles.ts`.
- **Sign-up guard:** one account can create at most 5 businesses (abuse protection; raise via support).
