# ADR 0001 — One monorepo for Lyra Reimagine products; a separate database per product

**Status:** Accepted (2026-11-15) · **Decided by:** product owner (repository created for it)

## Context

Lyra Reimagine will hold several independent industry products (Pet first, then Salon, Trade, Clean) that should reuse platform services (auth, tenancy, subscriptions, AI, notifications, admin) but never mix business data. Lyra Life OS already exists in its own repository with a single-user, personal data model.

## Decision

- **pnpm monorepo** (`akhng/Lyra-Reimagine`): `apps/<product>` for each product, `packages/platform` and `packages/ui` for shared code.
- **Lyra Life OS stays in its own repository**; it can move in later if wanted.
- **One Supabase project per product** (Lyra Pet: Sydney region), so each product's tenant data, migrations and backups are independent. Shared services are shared as code, not as a database.
- **Tenancy inside a product** is row-level: `business_id` on every business-owned row with RLS (see ARCHITECTURE).

## Consequences

- People who use two Lyra products have two logins for now; single sign-on across products would need a shared identity service later.
- Platform administration (Phase 6) runs per product with audited service-role access.
