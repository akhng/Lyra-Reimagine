# ADR 0003 — Pet care platform: new identity, two portals and a request marketplace

**Status:** Accepted (2026-11-15) · **Decided by:** product owner (transformation brief) · **Supersedes:** the identity part of ADR 0002

## Context

The owner found Lyra Pet too close to a generic business system and asked for a gamified pet care platform with a business portal, a customer portal and an Airtasker-style appointment marketplace, while keeping working functionality and the stack.

## Decisions

- **Identity.** Warm cream background, deep plum ink and lavender primary, coral secondary, mint, sky and butter accents; Baloo 2 (display) and Nunito (UI) via `next/font`; generous radii (24px cards, pill buttons), layered soft shadows; four original mascots — Coco (corgi), Mochi (white cat), Biscuit (golden retriever), Luna (grey cat) — drawn as SVG components with moods (happy, excited, sleepy, curious, proud) and poses (sit, wave, peek). No emoji as artwork. Motion 150–300 ms with lift, wave, pop and confetti, all disabled under `prefers-reduced-motion`. Contrast stays WCAG AA (plum text on cream, white on the lavender-deep primary).
- **Token names** change from `navy` to `ink` (the dark brand surface is now plum).
- **Two portals, one platform.** Staff keep `/b/<slug>`; customers get `/me`. One Supabase Auth account can be staff, customer or both; `/home` routes by what the person has.
- **Customers and pets are shared data.** A business customer record links to a person (`account_user_id`) through a verified-email claim; owner pet profiles link to business pets. Contact details remain hidden from groomers.
- **Requests before appointments.** Customers submit booking requests; businesses review, allocate or open them to eligible groomers; acceptance is atomic in the database and creates the appointment, so availability is validated before anything is confirmed.
- **Gamification is an engine, not page code:** point rules, a ledger and awards in the database, deduplicated by unique keys, optional per business, never affecting price or availability.
- **Drag and drop** uses `@dnd-kit` (keyboard and touch sensors); every tile is also a plain link.

## Consequences

- CLAUDE.md §10 (design) is updated to this identity.
- New tables and functions arrive in migrations with the R3–R5 pull requests (see `docs/phases/transformation-plan.md`).
- Email/SMS, payments and real photography stay behind interfaces until credentials or assets exist; nothing reports fake success.
