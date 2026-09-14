# FitStack — Modules 1 and 2

React 19, Vite, TypeScript, Tailwind v4, React Router v7, and shadcn/ui.

## Run

From this directory (Node 20.19+ or Node 22.12+):

```powershell
npm ci
npm run dev
```

Open the local URL printed by Vite. With no Supabase credentials, the login page explains configuration and offers explicitly labeled development previews. Choose Owner, Receptionist, Trainer, Member, or Super admin to inspect the relevant routes. Preview state is memory-only, clears on reload, never creates a Supabase session, and is compiled out of production builds.

Copy `.env.example` to `.env.local` and provide your project URL plus a publishable key (recommended) or legacy anon key when ready. Never put a service-role key in a VITE_ variable.

OTP screens are placeholders for Module 3. Supabase session restoration, gym selection, permission guards, theme persistence, and every requested page route are already wired.

## Apply Module 2

Open `supabase/fitstack-v1.sql`, copy the ENTIRE file, and paste it into the SQL Editor of a new Supabase project. Run once as postgres. It is one transaction with all 16 tables, constraints, functions, triggers, grants, RLS, and indexes. No Supabase CLI is needed.

The script is intended for an empty application schema. If installation fails, the transaction rolls back; it does not delete or replace existing user tables.

The SQL has been tested in an embedded PostgreSQL engine (PGlite) with stand-ins for Supabase's auth.users, auth.uid(), and pgcrypto. Supabase project settings, the actual pgcrypto extension, SMS, Edge Functions, Razorpay, and hosted PostgREST remain to be verified in their implementation modules. The SQL has NOT been applied to your hosted Supabase account.

### Development payment simulation

Vite development servers bypass `create-razorpay-order` and call the transactional `simulate_payment_checkout` database RPC. For an existing **development-only** database, apply `supabase/fitstack-dev-payment-simulation.sql` before testing checkout. Production builds continue to use Razorpay unless `VITE_DEV_MODE=true` is explicitly set. Do not apply the development RPC to a production database; it is intentionally restricted to signed-in gym users and refuses simulated captures once Razorpay credentials are configured.

## Security and integration contract

- Select explicit safe columns from `gyms`, `gym_members`, `payments`, and `scan_events`. Wildcard selects intentionally fail: QR secrets, encrypted gateway keys, signatures, and raw scans are not browser-readable.
- Profiles allow users to edit their own contact details but never their phone identity or super-admin flag. Staff directory access uses `get_member_directory(gym_id)`, which returns only member ID, name, phone, member code and activation state.
- Staff creation, role changes, payment creation/finalization, membership lifecycle changes, QR attendance and financial corrections require authorized server endpoints in later modules. Browser navigation guards are backed by database permissions.
- Owners/admins have read-only access when their gym is disabled. Members cannot read gym business data until reactivation.
- Same-tenant composite foreign keys reject mismatched member, plan, payment and actor IDs.
- The newest build request's operational CASCADE settings are used. Financial/audit references use RESTRICT, and there are no browser DELETE grants.
- `process_payment_capture` is executable only by the service role/SQL administrator. Its first five parameters match the prompt. Positive payments additionally require verified event ID and payload as arguments six and seven so event logging is atomic. The Edge Function must verify the raw-body Razorpay signature BEFORE calling it. The database checks order, payment ID, amount and currency.
- Server-created payment metadata should freeze `duration_type`, `duration_value`, and optional `purchase_mode: "upgrade"` when an order is prepared. Amounts and discounts are server-calculated. Never pass browser-trusted pricing.
- Zero-total payments skip Razorpay and finalize through the same function with null Razorpay/event arguments. A prepared payment row starts as `created`; it becomes `captured` only with the membership/invoice transaction.
- Finalization errors after an external capture must be retried/reconciled by Module 10. Its order-creation flow must prevent concurrent outstanding purchases and reserve limited promo capacity. A SQL rollback cannot reverse money already captured by Razorpay.
- Invoice numbering uses an IST year and a locked gym row. `reset_invoice_counters()` resets only when the stored year is stale; repeated calls in the same year do not reuse invoice numbers.
- Daily processing expires a current membership before activating its renewal. `sync_scheduled_renewal` is called by lifecycle endpoints after freezes, early resumes, extensions and holidays. Freezing must extend the current end date and record freeze history in one transaction before the cron can resume it.
- `parsePhone` returns ten national digits for form handling; `normalizePhone` returns E.164 for Auth and database storage.
- Theme defaults to light and remembers the preference. The gym accent uses a contrasting foreground. Reduced motion, labeled controls and mobile navigation are included.

## Verification

```powershell
npm run build
npm run lint
npm test
npm run test:browser
```

Browser tests need Playwright Chromium installed (`npx playwright install chromium`), or set `FITSTACK_CHROMIUM_PATH` to an existing Chrome/Chromium executable. Tests start Vite automatically and cover every placeholder, auth/role redirects, a 375px mobile viewport, navigation sheets, and persisted light/dark mode.

`tests/database.test.ts` applies the single SQL file in PGlite and checks RLS, protected columns, privilege escalation, cross-tenant relationships, payment replay and rollback, free checkout, date math, membership exclusivity, renewal shifts and invoice numbering.

## Source and command output

`../BUILD-OUTPUT.md` contains the full source listing, setup commands and the complete SQL in one code block. The actual source files and SQL alongside this README are authoritative.

The current SheetJS package is pinned to the official 0.20.3 tarball because npm's old xlsx 0.18.5 release reported vulnerabilities. See [official SheetJS installation](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/).

## Scope status

Module 1: scaffold implemented. Module 2: SQL generated and locally validated; hosted application awaits your manual paste. Modules 3–18 remain future implementation work.
