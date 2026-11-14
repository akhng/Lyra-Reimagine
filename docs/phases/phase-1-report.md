# Lyra Pet — Phase 1 report: architecture and foundation

## Implemented

| Area | Files |
|---|---|
| Monorepo | `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `eslint.config.mjs`, `vitest.config.mts`, `.github/workflows/ci.yml`, `.env.example` |
| Platform package | `packages/platform/src`: `env.ts` (Zod-validated, lazy), `errors.ts` (AppError, action results), `logger.ts`, `supabase/{server,browser,admin}.ts`, `auth/{session,safe-redirect}.ts`, `tenancy/{roles,slug,context}.ts`, generated `database.ts` |
| UI package | `packages/ui/src`: Button, Card, Input, Select, FormField (labels, hints, errors wired for assistive tech), Badge, EmptyState |
| Database | `supabase/migrations/20261115000000_platform_tenancy.sql`: `profiles` (auto-created on sign-up), `businesses` (slug, time zone, AUD, ABN, GST, plan, status), `business_members` (owner/manager/receptionist/groomer; active/invited/suspended), `locations` (address, AU state/postcode, mobile flag), `audit_log`; `is_business_member`, `has_business_role`, `create_business` (atomic, validated, 5 per account), `business_slug_available`; RLS on every table; column-level grants so plan/status/slug can't be changed by tenants |
| Test data | `supabase/seed.sql`: two separate test businesses and owners (local only) |
| App | `apps/pet`: landing page, sign-up (email verification), sign-in, sign-out, auth callback, onboarding (business name, booking link, time zone, first location), business shell `/b/<slug>` (sidebar on desktop, menu on phones), dashboard (business summary, set-up steps), settings (business details with ABN/GST, locations, team), CSP proxy, security headers |
| Docs | `CLAUDE.md`, `docs/ARCHITECTURE.md`, ADR 0001 (monorepo, separate databases), ADR 0002 (identity and scope choices), this plan and report |

## Tests

- `pnpm lint`, `pnpm typecheck`, `pnpm build`: pass.
- `pnpm test` (unit): 7/7 — routes and safe redirects, business schemas (slugs, ABN, postcodes), role permissions.
- `pnpm db:test`: 9/9 — business registration (atomic, audit), slug and time-zone validation, no anonymous creation; **tenant isolation**: each owner sees only their business, members, locations and audit log; writes into another business refused; owners can't change plan, status or slug or insert businesses directly; groomers read but can't change settings; suspended members lose access; anonymous visitors see nothing.
- `pnpm test:e2e`: 9/9 (desktop 1440, tablet 820, mobile 390) — sign-up with the real confirmation email (local Mailpit) → onboarding → dashboard → settings (ABN, GST, new mobile location) verified in the database; another business's pages return 404; a groomer sees settings read-only; anonymous visitors are sent to sign in and returned afterwards. axe (WCAG 2.2 AA) clean on every page visited.
- Screenshots checked: landing and dashboard at 1440px, dashboard at 390px.

## Brief acceptance tests covered so far

Test 1 (business registers and creates its tenant) ✓ · Test 15 (second business can't access the first) ✓ · Test 16 (role permissions) partly ✓ — groomer restrictions; subscription limits come in Phase 6.

## Not done yet / assumptions for Phase 2

- No cloud Supabase project or Vercel deployment yet (needs the owner's accounts).
- Staff invitations and role changes are Phase 4 (membership writes are locked to functions).
- Phase 2 adds customers, pets, grooming records (photos in Supabase Storage with tenant-scoped policies), services and pricing; every new table follows CLAUDE.md §5 and gets cross-tenant tests.
