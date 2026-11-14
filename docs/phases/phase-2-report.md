# Lyra Pet — Phase 2 report: core grooming

## Implemented

| Area | Files |
|---|---|
| Database | `supabase/migrations/20261116000000_core_grooming.sql`: customers, customer_contacts, pets, services, service_price_rules, grooming_records, grooming_photos; RLS on all; composite `(id, business_id)` FKs; no deletes of customers, contacts, pets or records; private `media` bucket with storage policies (`media_business(path)`); `customer_directory()` (list, search, groom counts, next due). `supabase/config.toml`: Storage enabled. |
| Logic | `features/services/pricing.ts` (estimate, AUD parse/format), `features/customers/schemas.ts` (customer, contact, segments), `features/pets/schemas.ts` (pet, typed row mapping, age), `features/grooming/schemas.ts` (record, photo path check), `lib/dates.ts`, `lib/form.ts`, `lib/params.ts`, `lib/upload.ts`, `lib/use-form-action.ts` |
| Server | `features/*/actions.ts` (save customer + contact with consent date, save pet, set pet photo, create grooming record with service-name snapshot, attach photos, save service + price rules), `features/*/queries.ts` (directory, customer, pets, history with signed photo URLs, recent grooms, services, team) |
| UI | `/b/<slug>/customers` (search, segment chips with counts, new, profile, edit), `/pets` (list, new, profile, edit, record a groom), `/grooming`, `/services` (list with price range, add, edit), dashboard KPIs (customers, new in 30 days, pets, grooms this month, due, inactive) and set-up steps, navigation, loading and error states, 404 page. Components: `FormBits`, `PageHeader`, `PetAvatar`, `CustomerForm`, `PetForm`, `PetPhotoUpload`, `GroomingRecordForm`, `GroomHistory` (history + "last time vs this time" comparison), `ServiceForm`. `packages/ui`: `Textarea`. |
| Docs | `docs/ARCHITECTURE.md` (core data, photos), `docs/phases/phase-2-plan.md`, this report |

## Decisions

- **Groomers can't see contact details:** contacts live in their own table readable only by owners, managers and reception. Customer search by email or mobile also respects this.
- **Photos:** the browser uploads straight to private storage under `<business>/grooming/<record>/`; the server checks every path belongs to the business and record before saving it. If some uploads fail, the record (and its notes) is kept and the user is told.
- **Forms keep input on errors:** React 19 resets forms after an `action` submit, which wiped what the user had typed when validation failed. `useFormAction` submits without the reset; applied to the Phase 1 settings forms too.
- **Price rules:** breed beats size beats base price; coat surcharges add on top. Breed prices are entered one per line ("Golden Retriever: 130").
- **Segments** come from real records (new ≤ 30 days, returning ≥ 2 grooms, inactive ≥ 90 days, due when last groom + the pet's interval has passed). The dashboard shows no sample numbers.

## Tests

- `pnpm check`: pass (lint with zero warnings, typecheck, unit 15/15, build).
- `pnpm db:test`: 19/19. New in this phase (10): customer, contacts and pets created; groomer can't read contacts or edit customers but can update pet preferences; directory search by name, pet, email and mobile (groomer can't match on contacts; another business sees nothing); cross-business reads and writes refused; composite FKs block cross-business links; services and pricing writable only by owner/manager; groomer records a groom and uploads a photo that the owner can download and another business can't; uploads into another business's folder refused; only the author or a manager edits a record and nobody deletes; next-due date.
- `pnpm test:e2e`: 15/15 (desktop 1440, tablet 820, mobile 390). New spec `core-grooming.spec.ts`: owner adds a service with size, breed and matting prices (bad amount rejected), adds a customer (postcode error keeps the form) with two pets, records a groom with before and after photos (wrong file type rejected), sees the before/after comparison, finds the customer by pet name and mobile, checks dashboard counts; a groomer sees care notes but not contact details, can't search by mobile, gets 404 on the edit page, records a groom with themself preselected, and sees services read-only. axe (WCAG 2.2 AA) clean on every page visited.
- Screenshots checked at 1440 and 390: dashboard, customers, pet profile with two grooms and photos, record-a-groom form, services.

## Brief acceptance tests covered

Test 3 (customer and pets) ✓ · Test 4 (grooming record with before/after photos) ✓ · Test 5 (services with size/breed pricing) ✓ · Test 6 (search by pet name and mobile) ✓ · Test 16 (role permissions) — groomer contact restrictions ✓.

## Migration to run

`supabase/migrations/20261116000000_core_grooming.sql` — only once the Lyra Pet Supabase project exists (Sydney region). It creates tables, policies and the private `media` bucket; no data changes.

## Not done / next

- Customer profile photo (column exists; pets have photos now).
- Archiving and privacy erase requests (Phase 6/7 data tools).
- Image resizing/thumbnails (Phase 7 performance).
- Phase 3 (scheduling and booking portal) needs: the Supabase project, and a domain for booking links.
