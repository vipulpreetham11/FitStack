# V2 Phase 0 verification — 2026-09-18

## Applied

Project: `sryrjeyuixsrhqgqglqb`.

- `20260918062134_v2_phase0_foundation.sql`
- `20260918062147_v2_phase0_follow_up_cron.sql`

Eight requested tables plus the three approved pending-bill/payment tables are live. All eleven have RLS enabled and four operation policies each. Same-gym foreign keys, scoped grants, immutable financial snapshots, protected salary/commission fields, invoice `customer_name`, and service-only payroll/credit operations are included.

The separate `fitstack-v2-auto-follow-ups` cron is active at `40 18 * * *` UTC (00:10 IST). Existing V1 jobs and functions were not replaced.

## Verification evidence

- Full `pnpm test`: **13 files / 85 tests passed**, including 18 Phase 0 database tests after migration filenames were aligned with the live migration history.
- Live rollback smoke (`supabase/tests/v2-phase0-smoke.sql`) passed: authenticated lead creator attribution, denied payroll-column reads, service-role walk-in invoice issuance, commission from `invoices.total_amount`, paid earnings freeze, credit issuance/redemption, invoice immutability, and repeated reminder generation without duplicate rows.
- Smoke transaction rolled back. Follow-up query found zero fixture gyms. Existing invoice count and revenue remained **5 / 26,250.00**, matching the immediate pre-apply snapshot.
- Live function definition hashes match pre-apply values for `guard_protected_fields`, `prevent_invoice_mutation`, `process_payment_capture`, `simulate_payment_checkout`, and `run_membership_lifecycle`.
- Migration review confirms no existing policy is altered or dropped. An exact catalog-wide before/after policy diff was not retained for this final verification.
- Catalog checks confirm all six new internal public functions deny anonymous/authenticated execution, permit service-role execution, and are SECURITY INVOKER. Authenticated users cannot select `gym_members.base_salary`.
- Local database tests cover tenant isolation, trainer assignment scope, same-gym FKs, forged actors, unauthorized billing/payroll writes, duplicate captures/invoices, anonymous membership rejection, credit limits, reminder source deduplication, and V1 invoice compatibility.

## Existing advisor findings

No new V2 security or unindexed-foreign-key findings were reported. Existing findings remain; this is not a claim that the project is warning-free:

- Four existing functions have [mutable search paths](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable).
- [Leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) is disabled.
- Existing authenticated SECURITY DEFINER APIs are flagged by the security advisor.
- 46 existing [unindexed foreign keys](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys), an existing profiles RLS initialization warning, and unused-index informational findings remain. New tables are empty, so unused-index findings are expected.

## Phase boundary

Phase 0 is the database foundation, not delivery of V2 checkout or frontend flows. No real Razorpay charge was made during verification. The live smoke uses synthetic captured-payment fixtures entirely within a rolled-back transaction.

Later phases still need authenticated Edge wrappers for service-only operations, atomic V2 Razorpay capture/stock/membership/invoice orchestration, webhook configuration, lead conversion through an Edge Function, and frontend implementation. Use `/member/*`, all eight lead stages, online Razorpay-only billing, and `invoices.total_amount` revenue throughout.

Changes are committed locally; pushing remains the user's action.
