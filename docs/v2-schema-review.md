# FitStack V2: schema compatibility review

Status: all six exceptions approved by the user. Phase 0 migrations applied on 2026-09-18. See v2-phase0-verification.md for verification and remaining phase boundaries.

## Confirmed product decision

All bill payments must use Razorpay. The user explicitly rejected staff-confirmed cash/bank/POS payments. Replace Phase 3's Mark Paid action with Razorpay checkout. Pending means an unpaid bill; membership access must never activate merely because checkout opened or a staff member clicked a button.

## Evidence from the live project

Inspected project `sryrjeyuixsrhqgqglqb` through Supabase MCP, including verbose table definitions, constraints, triggers, and policies.

| Brief assumption | Verified live schema | Impact |
| --- | --- | --- |
| `invoices.status` exists | No status column | Phase 0L payment reminders and pending-invoice statistics cannot run as written. |
| `invoices.amount` exists | Amount fields include `subtotal`, `taxable_amount`, `total_amount` | Report queries must choose the correct field explicitly. |
| Invoices can be anonymous | `invoices.member_id` is NOT NULL | Walk-in invoices need an explicit schema exception. |
| General POS payments use existing payments | `payments.member_id`, `plan_id`, and `requested_start_date` are NOT NULL | Product-only, service-only, and anonymous payments do not fit the V1 payment model. |
| Invoices can be updated after issue | `tr_invoice_immutable` rejects every UPDATE and DELETE | Do not update invoices to attach a credit note or settle a pending bill. |
| Credit notes track open/redeemed state | Existing columns are id, gym_id, invoice_id, credit_note_number, reason, amount, created_by, created_at | Open-credit statistics require additional state. |
| Profiles can be inserted independently | `profiles.id` references `auth.users.id` | Lead conversion needs an authorized server-side account/member workflow. |
| Member portal uses `/portal/*` | Existing routes use `/member/*` | Use `/member/*` throughout, without `/portal/*` aliases, per the user's correction. |
| Phase 0 creates nine tables | Eight CREATE TABLE statements are supplied | Use the eight named tables; do not invent a ninth to satisfy a count. |

The V1 invoice UI also reads `payments.status` through a relationship. It will need to recognize verified V2 bill payments while keeping the V1 path intact.

## Approved Phase 0 exceptions

These additions support the requested features while preserving issued invoices and the existing deployed payment functions.

1. Create the eight specified V2 tables and the specified `sold_by`, DOB, salary, and commission columns. Add same-gym foreign keys, validation checks, indexes, RLS, and narrowly scoped grants. Payroll fields must not inherit public/member visibility or receptionist write access simply because they are added to `gym_members`.
2. Add `bill_orders`, `bill_order_items`, and `bill_payments` for pending staff-created bills, persisted checkout line items, Razorpay order/payment references, and idempotent capture. Each row has `gym_id`; prices, discounts, stock, staff attribution, and totals are validated server-side. The existing `bill_items` remains the issued-invoice line-item table.
3. Allow `invoices.member_id` and `invoices.payment_id` to be null only for the new V2 billing path. Add a same-gym `bill_payment_id` relationship and a check requiring exactly one V1 payment or V2 bill payment. Require a member for V1 invoices; permit a named walk-in customer for V2 invoices. Add the user-requested `customer_name TEXT` invoice snapshot. Preserve the invoice immutability trigger and all existing invoice constraints that remain applicable.
4. Add `status`, `redeemed_amount`, and `credit_note_date` to credit notes, with bounds checks and server-authorized issuance/redemption. Read invoice-to-credit-note links through the existing `credit_notes.invoice_id` relationship. Do not mutate an issued invoice to set a reverse reference.
5. Add `is_active` to the new expenses table for archival. Follow the brief's global no-hard-delete rule; the conflicting hard-delete paragraph does not authorize deleting financial history by default.
6. Add protected server operations for payroll settings and paid payroll snapshots. Recalculation must never overwrite a paid month's salary, rate, or earnings.

## Payment and scheduling design

- Add separate V2 order creation, verification, and webhook endpoints. Existing `create-razorpay-order`, `razorpay-webhook`, and `process_payment_capture` retain their V1 behavior.
- Issue an immutable invoice and create purchased memberships only after authenticated server verification of captured Razorpay payment, using an atomic, idempotent database operation.
- Walk-in checkout supports non-membership items. A membership purchase requires a real gym member; no fake member or fake plan records.
- Configure the V2 webhook on each gym's Razorpay account before declaring asynchronous capture recovery verified. This is an integration dependency, not something the frontend callback can replace.
- Store unpaid balances and due dates on bill orders. Phase 0L reads pending bills instead of nonexistent pending invoices. Renewal reminders use existing memberships.
- Run follow-up generation through a separate cron, as allowed by the brief, without changing the deployed membership-lifecycle function.
- Use Asia/Kolkata calendar dates, lock/constrain generation against duplicates, and explicitly restrict internal execution.

## Reporting decisions to apply consistently

- Use `invoices.total_amount` for revenue, sales and commission calculations, as explicitly confirmed by the user.
- Use `/member/*` routes throughout; do not add `/portal/*` aliases.
- Convert leads through an authenticated server-side Edge Function; never insert profiles directly from the browser.
- Profit and loss must allocate revenue by invoice line type exactly once. Summing all invoices as membership revenue and then adding products/services would double-count mixed bills.
- Count a membership as a renewal only when that particular row has a prior membership. Do not label the first purchase as a renewal just because the member later renewed.
- A frozen or unpaid membership does not grant active access.
- The lead stages list contains eight states. Display all eight, including converted and lost, rather than silently dropping one to meet the brief's seven-column wording.

## Execution and validation after confirmation

Proceed in the requested order: Phase 0 schema and permission tests; Phase 1 subscriptions/invoices/credit notes; Phase 2 CRM; Phase 3 operations and Razorpay POS; Phase 4 earnings; Phase 5 dashboards/reports.

Before advancing each phase, verify relevant tenant isolation, role restrictions, computations, and user flows. Billing verification includes duplicate callbacks/webhooks, stock races, unpaid access denial, and walk-in scope. Preserve V1 regression coverage. Do not report mocked payment tests as a real Razorpay transaction.

Existing repository state at preflight: clean `main`, one local commit ahead of `origin/main` (`b2e8eb4`). No push performed.
