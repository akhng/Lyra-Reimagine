# Lyra Pet — Phase 2 plan: core grooming

Scope from the master brief §2/§5/§6: dashboard, customers, pets, grooming history with before/after photos, services and pricing.

## Approach

1. **Schema** (`supabase/migrations/20261116000000_core_grooming.sql`): customers, customer_contacts, pets, services, service_price_rules, grooming_records, grooming_photos, private `media` bucket with storage policies, `customer_directory()` for the list and search. RLS on every table; composite `(id, business_id)` foreign keys so nothing links across tenants.
2. **Pure logic with unit tests**: price estimates (breed > size > base, coat surcharges), AUD parsing and formatting, form schemas, customer segments (new, returning, VIP, inactive, due), pet age.
3. **Server actions and queries** under `apps/pet/src/features/*`, always with the user-scoped client and `requireBusiness` + `can()`.
4. **UI**: Customers (search, segment filters, profile, add/edit), Pets (list, profile with care information, preferences, history, comparison; add/edit; photo), Grooming records (record form with photo upload, recent list), Services & pricing, dashboard KPIs, navigation.
5. **Tests**: RLS tests per role and cross-business; Playwright at three viewports with axe.

## Decisions

- **Contact details in their own table** rather than column grants, so the groomer restriction is enforced by RLS row access and is easy to test.
- **No deletes** of customers, pets or records from the app in this phase. Archiving columns exist; a privacy erase flow (Australian Privacy Principles request) arrives with the data tools in Phase 6/7.
- **Browser-side photo upload** to private storage (Vercel limits server request bodies to 4.5 MB); the server validates paths before recording them.
- **Service names are snapshotted** on each grooming record so history stays readable when services change.
- **Customer segments** are computed from real records: new ≤ 30 days, returning ≥ 2 grooms, inactive ≥ 90 days since the last groom, due when last groom + the pet's interval has passed.

## Risks

- Large salons: the directory function computes per call; fine for thousands of customers, revisit with pagination when Phase 3 adds appointments.
- Photo storage costs: 8 MB cap per photo, 6 before + 6 after per record. Image resizing is a Phase 7 performance item.
