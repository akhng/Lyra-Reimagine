# Lyra Pet — Phase 1 plan: architecture and foundation

Source: Lyra Pet master prompt (2026-11-15), ADR 0001–0002.

## Inspection

Empty repository (`akhng/Lyra-Reimagine`). Proven patterns reused from Lyra Life OS: Supabase SSR session handling, CSP proxy, environment validation, Vitest/Playwright setup. No Life OS data or schema is reused.

## Scope

1. pnpm monorepo: `apps/pet`, `packages/platform`, `packages/ui`; lint, typecheck, unit, DB and e2e tooling; CI.
2. Tenancy schema: `profiles`, `businesses`, `business_members` (roles), `locations`, `audit_log`; membership and role helper functions; RLS on everything; `create_business()`; slug availability.
3. Auth: sign-up with email verification, sign-in, sign-out, callback; protected routes.
4. Business registration (onboarding) and the business shell under `/b/<slug>`.
5. Dashboard (business summary and set-up steps from real data) and Settings (business details with ABN and GST, locations, team list).
6. Tests: tenant isolation (DB), roles and schemas (unit), sign-up → business → settings, cross-tenant 404, groomer read-only (e2e at three viewports with axe).

## Risks

- Cross-tenant leakage → RLS everywhere, helper functions, column-level grants, cross-tenant tests for every table.
- Signup abuse → email verification, 5-business-per-account limit; rate limits later on public endpoints.
- Scope creep → appointments, customers and payments wait for Phases 2–4.
