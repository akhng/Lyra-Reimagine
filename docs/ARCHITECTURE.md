# Lyra Reimagine — architecture

## Products and platform

```
Lyra Reimagine (this repo)
├─ apps/pet            Lyra Pet — pet grooming business SaaS (first product)
├─ apps/salon …        future products, each an independent app
├─ packages/platform   shared services: env, auth/session, tenancy, Supabase clients, logging, errors
└─ packages/ui         shared design-system primitives
Lyra Life OS           separate repository and database (ADR 0001)
```

Each product has its own Supabase project (Lyra Pet: Sydney region in production) and its own Vercel project. Shared code is reused through workspace packages, not shared databases.

## Tenancy

- A **business** is the tenant. People sign in with Supabase Auth and belong to businesses through **business_members** (role: owner, manager, receptionist, groomer; status: active, invited, suspended).
- Every business-owned row has `business_id`; Row Level Security permits access only to active members, by role:
  - `is_business_member(business_id)` — any active member;
  - `has_business_role(business_id, roles[])` — specific roles.
- **Locations** belong to a business (salons, shopfronts or a mobile van). Later tables (customers, pets, appointments, staff rosters, payments) carry both `business_id` and, where relevant, `location_id` with composite foreign keys so references can't cross tenants.
- **Business creation** happens only through `create_business()` (security definer): business, owner membership, first location and an audit entry in one transaction. Plan and status are platform-controlled (column-level grants).
- **Audit log** records privileged and settings actions per business, never customer details.
- In the app, every page under `/b/<slug>` resolves the tenant with `requireBusiness(slug)`: RLS returns nothing for non-members, so another tenant's URL is a 404.

## Request flow

`UI (Server Components / Server Actions) → feature actions (Zod validation, permission check) → user-scoped Supabase client (RLS) → Postgres`. Elevated operations use security-definer functions that check `auth.uid()` themselves.

## Security

- Session cookies via `@supabase/ssr`; `apps/pet/src/proxy.ts` refreshes sessions, sets a CSP nonce and redirects anonymous users from protected routes.
- Only the Supabase URL and anon key reach the browser.
- Email verification required to sign in.

## Roadmap (phases)

| Phase | Scope |
|---|---|
| 1 | Foundation: monorepo, tenancy, auth, business registration, settings (this phase) |
| 2 | Core grooming: dashboard, customers, pets, grooming history (before/after photos), services and pricing |
| 3 | Scheduling: calendars, booking engine with database-level overlap prevention, public booking portal, recurring bookings, cancellations, waitlist |
| 4 | Operations: staff and rosters, invitations, payments (Stripe Connect), email/SMS notifications |
| 5 | AI and growth: grooming assistant, retention, loyalty, marketing, business intelligence |
| 6 | SaaS commercialisation: plans and entitlements, Stripe Billing, platform administration, usage |
| 7 | Production readiness: security review, performance, deployment |
