# CLAUDE.md — Lyra Reimagine

> Read this file fully at the start of every session. It is the source of truth for how to work in this repository.

## 1. What this repository is

**Lyra Reimagine** is a family of independent, industry-specific SaaS products on shared platform infrastructure. Current product: **Lyra Pet** — pet grooming business management for independent groomers, small salons and multi-location businesses in Australia (`apps/pet`). Future: Lyra Salon, Lyra Trade, Lyra Clean (each its own app). **Lyra Life OS lives in a separate repository** and shares no database with these products.

Lyra Pet's promise: *Spend less time managing your business and more time caring for pets.* It must be simple for a sole trader and powerful for a multi-staff salon.

Authoritative documents:

| Document | Purpose |
|---|---|
| `docs/ARCHITECTURE.md` | Structure, tenancy model, roles, data flow |
| `docs/adr/*.md` | Decisions and why |
| `docs/phases/*` | Phase plans and reports |
| `supabase/migrations/*.sql` | Schema and Row Level Security (authoritative for data shape) |

## 2. Stack (do not substitute without an ADR)

pnpm workspaces · Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind 4 · Supabase (Postgres, Auth, RLS, Storage) · Zod at every trust boundary · Vitest · Playwright · Vercel. Payments: Stripe Connect + Billing (test mode until launch). AI: Anthropic Claude behind a provider interface (Phase 5). No ORM.

## 3. Commands

```bash
pnpm install
pnpm dev            # Lyra Pet on http://localhost:3200
pnpm db:start       # local Supabase (API 55321, DB 55322, Studio 55323, Mailpit 55324)
pnpm db:reset       # re-apply migrations + seed
pnpm db:types       # regenerate packages/platform/src/database.ts
pnpm db:test        # tenant isolation and RLS tests
pnpm test           # unit tests
pnpm test:e2e       # Playwright (desktop 1440, tablet 820, mobile 390), port 3300
pnpm check          # lint + typecheck + unit + build (the "done" gate, with db:test and e2e)
```

## 4. Layout

```
apps/pet/            Lyra Pet (Next.js): src/app routes (thin), src/components, src/features/<feature>/{schemas,actions,queries}.ts, tests/e2e
packages/platform/   Shared: env, errors, logger, Supabase clients, session, tenancy (roles, slugs, business context), generated DB types
packages/ui/         Shared design-system primitives (Button, Card, FormField, Badge, EmptyState…)
supabase/            One local project for Lyra Pet: config, migrations, seed (test data only)
tests/db/            Database / RLS tests against the local stack
docs/                Architecture, ADRs, phase plans and reports
```

## 5. Multi-tenancy rules (hard)

1. **Every business-owned table has `business_id uuid not null references businesses on delete cascade` and RLS enabled.** A table without RLS is a bug.
2. Policies use `public.is_business_member(business_id)` and `public.has_business_role(business_id, roles)`. Never filter tenants only in the frontend.
3. Cross-table references that must stay inside one business use composite foreign keys `(id, business_id)`.
4. Use the **user-scoped** Supabase client by default. The service-role client (`@lyra/platform/supabase/admin`) is only for scheduled jobs, audited platform administration and tests — with a comment and a server-derived tenant id.
5. Never trust a `business_id` or role from the client: resolve the business from the URL slug with `requireBusiness(slug)` (404 for non-members) and check permissions with `can(role, permission)` on the server.
6. Every new table gets cross-tenant tests: a member of business A must fail to read or write business B's rows.
7. Writes that must be atomic or need elevated rights go through `security definer` functions that check `auth.uid()` and membership themselves.

## 6. Roles and permissions

`owner`, `manager`, `receptionist`, `groomer` (see `packages/platform/src/tenancy/roles.ts`; the database mirrors it). Groomers get only what they need to groom (pet care information), not customer contact details, payments or settings.

## 7. Product rules (hard)

- **No fabricated data.** Dashboards, reports and insights are computed from real records. Empty states explain and offer the next step.
- **AI (Phase 5):** suggestions for staff to review, based only on recorded data. Never diagnose animal health or prescribe treatment. Never invent pet medical information, allergies, behaviour or history.
- **Payments:** never store raw card details; Stripe handles cards. Support AUD, GST and tax invoice details.
- **Messaging:** marketing needs recorded consent and an unsubscribe (Australian Spam Act). Business-owner approval before marketing sends.
- **Bookings:** no overlapping appointments for the same groomer — enforce in the database, not just the UI.
- **Never log** customer names, contact details, pet care notes or payment data. Log ids, counts, latencies.
- Test and sample data live only in `supabase/seed.sql` / test fixtures, clearly marked, never in production paths.

## 8. Security

Only `NEXT_PUBLIC_*` values reach the browser (Supabase URL and anon key). CSP with nonces in `apps/pet/src/proxy.ts`; security headers in `next.config.ts`. Email verification on. Rate-limit public endpoints (booking portal) when they arrive.

## 9. Conventions

TypeScript strict, no `any`, no non-null assertions without a comment. Components `PascalCase.tsx`, other files `kebab-case.ts`, DB `snake_case`. Server actions return `{ ok, data } | { ok: false, error }`-style results or form state; validate with Zod. Comments explain *why*. No `console.log`. English (Australian) copy; i18n can be added later (ADR 0002).

## 10. Design

Lyra Pet: navy, teal and warm neutrals; Plus Jakarta Sans for display, Inter for UI; rounded cards with subtle shadows; calm, premium, friendly — not childish, not a generic admin dashboard. Tokens in `apps/pet/src/app/globals.css`, never hex in components. WCAG AA contrast, visible focus, keyboard navigation, labelled controls, ≥ 44px tap targets. Staff screens work on phones and tablets; administration is desktop-first. Verify at 390, 820 and 1440px.

## 11. Definition of done

1. `pnpm check`, `pnpm db:test` and `pnpm test:e2e` pass with no warnings.
2. New logic has unit tests; new tables have RLS and cross-tenant tests.
3. New user flows have Playwright tests at the three viewports, with axe checks.
4. Docs updated (architecture, ADR if a decision changed) and a phase report written: files, decisions, tests and results, gaps, what the next phase assumes.

Never mark something done because it "should work". If something can't be run (missing credentials), say so and list what remains unverified.

## 12. Stop and ask when

A credential is missing; a requirement contradicts another in a way that changes the product; a destructive or irreversible data operation is needed; a new paid service or major dependency is required; two fix attempts on the same failure haven't worked.
