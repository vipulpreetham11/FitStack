-- FitStack Module 2: ONE script for a NEW Supabase project SQL Editor.
-- Run once as postgres. The entire installation is transactional.
-- Browser-safe columns are explicitly granted; do not replace with GRANT ALL.
BEGIN;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;
SET LOCAL search_path = public, extensions, pg_catalog;

-- ==========================================
-- SECTION 1: TABLES (16)
-- ==========================================
CREATE TABLE public.gyms (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  slug            text UNIQUE NOT NULL,
  logo_url        text,
  brand_color     text DEFAULT '#000000',
  brand_color_secondary text,
  address         text,
  city            text,
  state           text,
  pincode         text,
  phone           text,
  email           text,
  website         text,
  gstin           text,
  business_hours  jsonb DEFAULT '{"open": "06:00", "close": "22:00"}',
  working_days    jsonb DEFAULT '[1,2,3,4,5,6]',
  timezone        text DEFAULT 'Asia/Kolkata',
  invoice_prefix  text DEFAULT 'INV',
  invoice_year    integer DEFAULT (EXTRACT(YEAR FROM (now() AT TIME ZONE 'Asia/Kolkata'))::integer),
  invoice_counter integer DEFAULT 0,
  gst_inclusive   boolean DEFAULT false,
  razorpay_key_id_enc     text,
  razorpay_key_secret_enc text,
  razorpay_webhook_secret_enc text,
  is_active       boolean DEFAULT true,
  settings        jsonb DEFAULT '{}',
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE TABLE public.profiles (
  id                      uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone                   text UNIQUE, -- normalized E.164, e.g. +919876543210
  email                   text,
  full_name               text NOT NULL,
  avatar_url              text,
  date_of_birth           date,
  gender                  text CHECK (gender IN ('male','female','other')),
  address                 text,
  emergency_contact_name  text,
  emergency_contact_phone text,
  is_super_admin          boolean DEFAULT false,
  created_at              timestamptz DEFAULT now(),
  updated_at              timestamptz DEFAULT now()
);

CREATE TABLE public.gym_members (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id      uuid NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  profile_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role        text NOT NULL DEFAULT 'member'
              CHECK (role IN ('owner','admin','receptionist','trainer','member')),
  member_code text,
  qr_secret   text NOT NULL DEFAULT encode(extensions.gen_random_bytes(32), 'hex'),
  is_active   boolean DEFAULT true,
  joined_at   timestamptz DEFAULT now(),
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  UNIQUE(gym_id, profile_id)
);

CREATE TABLE public.membership_plans (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id          uuid NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  name            text NOT NULL,
  description     text,
  price           numeric(10,2) NOT NULL CHECK (price >= 0),
  duration_type   text NOT NULL CHECK (duration_type IN ('days','months','years')),
  duration_value  integer NOT NULL CHECK (duration_value > 0),
  features        jsonb DEFAULT '[]',
  max_freezes     integer CHECK (max_freezes IS NULL OR max_freezes >= 0),
  max_freeze_days integer CHECK (max_freeze_days IS NULL OR max_freeze_days > 0),
  allow_future_start boolean DEFAULT true,
  is_active       boolean DEFAULT true,
  sort_order      integer DEFAULT 0,
  created_by      uuid REFERENCES public.gym_members(id),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE TABLE public.promo_codes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id              uuid NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  code                text NOT NULL,
  discount_type       text NOT NULL CHECK (discount_type IN ('percentage','flat')),
  discount_value      numeric(10,2) NOT NULL CHECK (discount_value > 0),
  max_discount_amount numeric(10,2),
  max_uses            integer,
  used_count          integer DEFAULT 0,
  valid_from          timestamptz DEFAULT now(),
  valid_until         timestamptz,
  applicable_plan_ids jsonb,
  is_active           boolean DEFAULT true,
  created_by          uuid REFERENCES public.gym_members(id),
  created_at          timestamptz DEFAULT now(),
  UNIQUE(gym_id, code)
);

CREATE TABLE public.payments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id              uuid NOT NULL REFERENCES public.gyms(id) ON DELETE RESTRICT,
  member_id           uuid NOT NULL REFERENCES public.gym_members(id) ON DELETE RESTRICT,
  plan_id             uuid NOT NULL REFERENCES public.membership_plans(id) ON DELETE RESTRICT,
  requested_start_date date NOT NULL,
  amount              numeric(10,2) NOT NULL CHECK (amount >= 0),
  discount_amount     numeric(10,2) DEFAULT 0 CHECK (discount_amount >= 0),
  taxable_amount      numeric(10,2) NOT NULL CHECK (taxable_amount >= 0),
  gst_rate            numeric(4,2) DEFAULT 5.00,
  cgst_amount         numeric(10,2) NOT NULL CHECK (cgst_amount >= 0),
  sgst_amount         numeric(10,2) NOT NULL CHECK (sgst_amount >= 0),
  total_amount        numeric(10,2) NOT NULL CHECK (total_amount >= 0),
  currency            text DEFAULT 'INR',
  razorpay_order_id   text,
  razorpay_payment_id text,
  razorpay_signature  text,
  status              text NOT NULL DEFAULT 'created'
                      CHECK (status IN ('created','captured','failed')),
  promo_code_id       uuid, -- FK to promo_codes added after both tables exist
  description         text,
  metadata            jsonb DEFAULT '{}',
  created_by          uuid REFERENCES public.gym_members(id),
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

CREATE TABLE public.memberships (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id            uuid NOT NULL REFERENCES public.gyms(id) ON DELETE RESTRICT,
  member_id         uuid NOT NULL REFERENCES public.gym_members(id) ON DELETE RESTRICT,
  plan_id           uuid NOT NULL REFERENCES public.membership_plans(id) ON DELETE RESTRICT,
  payment_id        uuid, -- FK to payments added after both tables exist
  status            text NOT NULL DEFAULT 'scheduled'
                    CHECK (status IN ('scheduled','active','frozen','expired','cancelled')),
  start_date        date NOT NULL,
  end_date          date NOT NULL,
  original_end_date date NOT NULL,
  frozen_at         timestamptz,
  frozen_until      date,
  freeze_count      integer DEFAULT 0,
  total_freeze_days integer DEFAULT 0,
  notes             text,
  created_by        uuid REFERENCES public.gym_members(id),
  cancelled_at      timestamptz,
  cancelled_by      uuid REFERENCES public.gym_members(id),
  cancellation_reason text,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

CREATE TABLE public.membership_freezes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id        uuid NOT NULL REFERENCES public.gyms(id) ON DELETE RESTRICT,
  membership_id uuid NOT NULL REFERENCES public.memberships(id) ON DELETE RESTRICT,
  frozen_at     timestamptz NOT NULL DEFAULT now(),
  planned_days  integer NOT NULL CHECK (planned_days > 0),
  resume_at     timestamptz,
  actual_days   integer,
  resumed_early boolean DEFAULT false,
  reason        text,
  created_by    uuid REFERENCES public.gym_members(id),
  created_at    timestamptz DEFAULT now()
);

CREATE TABLE public.membership_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id        uuid NOT NULL REFERENCES public.gyms(id) ON DELETE RESTRICT,
  membership_id uuid NOT NULL REFERENCES public.memberships(id) ON DELETE RESTRICT,
  event_type    text NOT NULL CHECK (event_type IN (
    'created','activated','frozen','resumed','extended',
    'cancelled','expired','upgraded','holiday_extended'
  )),
  from_status   text,
  to_status     text,
  details       jsonb DEFAULT '{}',
  performed_by  uuid REFERENCES public.gym_members(id),
  created_at    timestamptz DEFAULT now()
);

CREATE TABLE public.invoices (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id          uuid NOT NULL REFERENCES public.gyms(id) ON DELETE RESTRICT,
  member_id       uuid NOT NULL REFERENCES public.gym_members(id) ON DELETE RESTRICT,
  payment_id      uuid NOT NULL REFERENCES public.payments(id) ON DELETE RESTRICT,
  invoice_number  text NOT NULL,
  invoice_date    date NOT NULL DEFAULT ((now() AT TIME ZONE 'Asia/Kolkata')::date),
  gym_name        text NOT NULL,
  gym_address     text,
  gym_gstin       text,
  member_name     text NOT NULL,
  member_phone    text,
  items           jsonb NOT NULL,
  subtotal        numeric(10,2) NOT NULL,
  discount_amount numeric(10,2) DEFAULT 0,
  taxable_amount  numeric(10,2) NOT NULL,
  cgst_rate       numeric(4,2) DEFAULT 2.50,
  cgst_amount     numeric(10,2) NOT NULL,
  sgst_rate       numeric(4,2) DEFAULT 2.50,
  sgst_amount     numeric(10,2) NOT NULL,
  total_amount    numeric(10,2) NOT NULL,
  payment_method  text DEFAULT 'online',
  payment_ref     text,
  notes           text,
  created_at      timestamptz DEFAULT now(),
  UNIQUE(gym_id, invoice_number)
);

CREATE TABLE public.razorpay_webhook_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id      uuid NOT NULL REFERENCES public.gyms(id) ON DELETE RESTRICT,
  payment_id  uuid NOT NULL REFERENCES public.payments(id) ON DELETE RESTRICT,
  event_id    text NOT NULL UNIQUE,
  event_type  text NOT NULL,
  payload     jsonb NOT NULL,
  processed   boolean DEFAULT false,
  error       text,
  processed_at timestamptz,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE public.credit_notes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id              uuid NOT NULL REFERENCES public.gyms(id) ON DELETE RESTRICT,
  invoice_id          uuid NOT NULL REFERENCES public.invoices(id) ON DELETE RESTRICT,
  credit_note_number  text NOT NULL,
  reason              text NOT NULL,
  amount              numeric(10,2) NOT NULL CHECK (amount > 0),
  created_by          uuid REFERENCES public.gym_members(id),
  created_at          timestamptz DEFAULT now(),
  UNIQUE(gym_id, credit_note_number)
);

CREATE TABLE public.access_devices (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id    uuid NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  name      text NOT NULL,
  type      text NOT NULL CHECK (type IN ('qr_scanner','biometric','tablet')),
  location  text,
  is_active boolean DEFAULT true,
  config    jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.attendance (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id       uuid NOT NULL REFERENCES public.gyms(id) ON DELETE RESTRICT,
  member_id    uuid NOT NULL REFERENCES public.gym_members(id) ON DELETE RESTRICT,
  check_in_at  timestamptz NOT NULL DEFAULT now(),
  check_out_at timestamptz,
  method       text DEFAULT 'qr' CHECK (method IN ('qr','biometric','manual')),
  device_id    uuid REFERENCES public.access_devices(id),
  created_at   timestamptz DEFAULT now()
);

CREATE TABLE public.scan_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id          uuid NOT NULL REFERENCES public.gyms(id) ON DELETE RESTRICT,
  member_id       uuid REFERENCES public.gym_members(id) ON DELETE RESTRICT,
  scanned_at      timestamptz NOT NULL DEFAULT now(),
  result          text NOT NULL CHECK (result IN ('allowed','denied','override')),
  denial_reason   text,
  override_by     uuid REFERENCES public.gym_members(id) ON DELETE RESTRICT,
  override_reason text,
  device_id       uuid REFERENCES public.access_devices(id),
  raw_qr_data     text,
  created_at      timestamptz DEFAULT now()
);

CREATE TABLE public.gym_holidays (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id              uuid NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  name                text NOT NULL,
  date                date NOT NULL,
  reason              text,
  affects_membership  boolean DEFAULT false,
  is_active           boolean DEFAULT true,
  created_by          uuid REFERENCES public.gym_members(id),
  created_at          timestamptz DEFAULT now(),
  UNIQUE(gym_id, date)
);

-- ==========================================
-- SECTION 2: DEFERRED FOREIGN KEYS AND CHECKS
-- ==========================================
ALTER TABLE public.memberships ADD CONSTRAINT fk_memberships_payment FOREIGN KEY (payment_id) REFERENCES public.payments(id) ON DELETE RESTRICT;
ALTER TABLE public.payments ADD CONSTRAINT fk_payments_promo_code FOREIGN KEY (promo_code_id) REFERENCES public.promo_codes(id) ON DELETE RESTRICT;
ALTER TABLE public.gym_members ADD CONSTRAINT gym_members_gym_id_pair UNIQUE (gym_id,id);
ALTER TABLE public.membership_plans ADD CONSTRAINT membership_plans_gym_id_pair UNIQUE (gym_id,id);
ALTER TABLE public.promo_codes ADD CONSTRAINT promo_codes_gym_id_pair UNIQUE (gym_id,id);
ALTER TABLE public.payments ADD CONSTRAINT payments_gym_id_pair UNIQUE (gym_id,id);
ALTER TABLE public.memberships ADD CONSTRAINT memberships_gym_id_pair UNIQUE (gym_id,id);
ALTER TABLE public.membership_freezes ADD CONSTRAINT membership_freezes_gym_id_pair UNIQUE (gym_id,id);
ALTER TABLE public.membership_events ADD CONSTRAINT membership_events_gym_id_pair UNIQUE (gym_id,id);
ALTER TABLE public.invoices ADD CONSTRAINT invoices_gym_id_pair UNIQUE (gym_id,id);
ALTER TABLE public.razorpay_webhook_events ADD CONSTRAINT razorpay_webhook_events_gym_id_pair UNIQUE (gym_id,id);
ALTER TABLE public.credit_notes ADD CONSTRAINT credit_notes_gym_id_pair UNIQUE (gym_id,id);
ALTER TABLE public.access_devices ADD CONSTRAINT access_devices_gym_id_pair UNIQUE (gym_id,id);
ALTER TABLE public.attendance ADD CONSTRAINT attendance_gym_id_pair UNIQUE (gym_id,id);
ALTER TABLE public.scan_events ADD CONSTRAINT scan_events_gym_id_pair UNIQUE (gym_id,id);
ALTER TABLE public.gym_holidays ADD CONSTRAINT gym_holidays_gym_id_pair UNIQUE (gym_id,id);
ALTER TABLE public.membership_plans ADD CONSTRAINT membership_plans_created_by_tenant_fk FOREIGN KEY (gym_id,created_by) REFERENCES public.gym_members(gym_id,id) ON DELETE RESTRICT;
ALTER TABLE public.promo_codes ADD CONSTRAINT promo_codes_created_by_tenant_fk FOREIGN KEY (gym_id,created_by) REFERENCES public.gym_members(gym_id,id) ON DELETE RESTRICT;
ALTER TABLE public.payments ADD CONSTRAINT payments_member_id_tenant_fk FOREIGN KEY (gym_id,member_id) REFERENCES public.gym_members(gym_id,id) ON DELETE RESTRICT;
ALTER TABLE public.payments ADD CONSTRAINT payments_plan_id_tenant_fk FOREIGN KEY (gym_id,plan_id) REFERENCES public.membership_plans(gym_id,id) ON DELETE RESTRICT;
ALTER TABLE public.payments ADD CONSTRAINT payments_promo_code_id_tenant_fk FOREIGN KEY (gym_id,promo_code_id) REFERENCES public.promo_codes(gym_id,id) ON DELETE RESTRICT;
ALTER TABLE public.payments ADD CONSTRAINT payments_created_by_tenant_fk FOREIGN KEY (gym_id,created_by) REFERENCES public.gym_members(gym_id,id) ON DELETE RESTRICT;
ALTER TABLE public.memberships ADD CONSTRAINT memberships_member_id_tenant_fk FOREIGN KEY (gym_id,member_id) REFERENCES public.gym_members(gym_id,id) ON DELETE RESTRICT;
ALTER TABLE public.memberships ADD CONSTRAINT memberships_plan_id_tenant_fk FOREIGN KEY (gym_id,plan_id) REFERENCES public.membership_plans(gym_id,id) ON DELETE RESTRICT;
ALTER TABLE public.memberships ADD CONSTRAINT memberships_payment_id_tenant_fk FOREIGN KEY (gym_id,payment_id) REFERENCES public.payments(gym_id,id) ON DELETE RESTRICT;
ALTER TABLE public.memberships ADD CONSTRAINT memberships_created_by_tenant_fk FOREIGN KEY (gym_id,created_by) REFERENCES public.gym_members(gym_id,id) ON DELETE RESTRICT;
ALTER TABLE public.memberships ADD CONSTRAINT memberships_cancelled_by_tenant_fk FOREIGN KEY (gym_id,cancelled_by) REFERENCES public.gym_members(gym_id,id) ON DELETE RESTRICT;
ALTER TABLE public.membership_freezes ADD CONSTRAINT membership_freezes_membership_id_tenant_fk FOREIGN KEY (gym_id,membership_id) REFERENCES public.memberships(gym_id,id) ON DELETE RESTRICT;
ALTER TABLE public.membership_freezes ADD CONSTRAINT membership_freezes_created_by_tenant_fk FOREIGN KEY (gym_id,created_by) REFERENCES public.gym_members(gym_id,id) ON DELETE RESTRICT;
ALTER TABLE public.membership_events ADD CONSTRAINT membership_events_membership_id_tenant_fk FOREIGN KEY (gym_id,membership_id) REFERENCES public.memberships(gym_id,id) ON DELETE RESTRICT;
ALTER TABLE public.membership_events ADD CONSTRAINT membership_events_performed_by_tenant_fk FOREIGN KEY (gym_id,performed_by) REFERENCES public.gym_members(gym_id,id) ON DELETE RESTRICT;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_member_id_tenant_fk FOREIGN KEY (gym_id,member_id) REFERENCES public.gym_members(gym_id,id) ON DELETE RESTRICT;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_payment_id_tenant_fk FOREIGN KEY (gym_id,payment_id) REFERENCES public.payments(gym_id,id) ON DELETE RESTRICT;
ALTER TABLE public.razorpay_webhook_events ADD CONSTRAINT razorpay_webhook_events_payment_id_tenant_fk FOREIGN KEY (gym_id,payment_id) REFERENCES public.payments(gym_id,id) ON DELETE RESTRICT;
ALTER TABLE public.credit_notes ADD CONSTRAINT credit_notes_invoice_id_tenant_fk FOREIGN KEY (gym_id,invoice_id) REFERENCES public.invoices(gym_id,id) ON DELETE RESTRICT;
ALTER TABLE public.credit_notes ADD CONSTRAINT credit_notes_created_by_tenant_fk FOREIGN KEY (gym_id,created_by) REFERENCES public.gym_members(gym_id,id) ON DELETE RESTRICT;
ALTER TABLE public.attendance ADD CONSTRAINT attendance_member_id_tenant_fk FOREIGN KEY (gym_id,member_id) REFERENCES public.gym_members(gym_id,id) ON DELETE RESTRICT;
ALTER TABLE public.attendance ADD CONSTRAINT attendance_device_id_tenant_fk FOREIGN KEY (gym_id,device_id) REFERENCES public.access_devices(gym_id,id) ON DELETE RESTRICT;
ALTER TABLE public.scan_events ADD CONSTRAINT scan_events_member_id_tenant_fk FOREIGN KEY (gym_id,member_id) REFERENCES public.gym_members(gym_id,id) ON DELETE RESTRICT;
ALTER TABLE public.scan_events ADD CONSTRAINT scan_events_device_id_tenant_fk FOREIGN KEY (gym_id,device_id) REFERENCES public.access_devices(gym_id,id) ON DELETE RESTRICT;
ALTER TABLE public.scan_events ADD CONSTRAINT scan_events_override_by_tenant_fk FOREIGN KEY (gym_id,override_by) REFERENCES public.gym_members(gym_id,id) ON DELETE RESTRICT;
ALTER TABLE public.gym_holidays ADD CONSTRAINT gym_holidays_created_by_tenant_fk FOREIGN KEY (gym_id,created_by) REFERENCES public.gym_members(gym_id,id) ON DELETE RESTRICT;

ALTER TABLE public.gyms ADD CHECK (timezone = 'Asia/Kolkata'), ADD CHECK (invoice_counter >= 0), ADD CHECK (NOT gst_inclusive), ADD CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
ALTER TABLE public.profiles ADD CHECK (phone IS NULL OR phone ~ '^\+91[6-9][0-9]{9}$');
ALTER TABLE public.memberships ADD CHECK (end_date >= start_date), ADD CHECK (freeze_count >= 0 AND total_freeze_days >= 0);
ALTER TABLE public.membership_freezes ADD CHECK (actual_days IS NULL OR actual_days >= 0);
ALTER TABLE public.membership_events ADD CHECK (from_status IS NULL OR from_status IN ('scheduled','active','frozen','expired','cancelled')), ADD CHECK (to_status IS NULL OR to_status IN ('scheduled','active','frozen','expired','cancelled'));
ALTER TABLE public.promo_codes ADD CHECK (discount_type <> 'percentage' OR discount_value <= 100), ADD CHECK (used_count >= 0 AND (max_uses IS NULL OR (max_uses >= 0 AND used_count <= max_uses))), ADD CHECK (valid_until IS NULL OR valid_until >= valid_from), ADD CHECK (max_discount_amount IS NULL OR max_discount_amount >= 0);
ALTER TABLE public.payments ADD CHECK (discount_amount <= amount AND taxable_amount = amount - discount_amount), ADD CHECK (total_amount = taxable_amount + cgst_amount + sgst_amount), ADD CHECK (gst_rate BETWEEN 0 AND 100), ADD CHECK (currency = 'INR');
ALTER TABLE public.invoices ADD CHECK (payment_method IN ('online','free')), ADD CHECK (total_amount = taxable_amount + cgst_amount + sgst_amount), ADD CHECK (taxable_amount = subtotal - discount_amount), ADD CHECK (subtotal >= 0 AND discount_amount >= 0 AND taxable_amount >= 0 AND cgst_amount >= 0 AND sgst_amount >= 0);
ALTER TABLE public.attendance ADD CHECK (check_out_at IS NULL OR check_out_at >= check_in_at);
ALTER TABLE public.scan_events ADD CHECK (result <> 'override' OR (override_by IS NOT NULL AND length(trim(override_reason)) > 0));
ALTER TABLE public.gyms ALTER COLUMN id SET NOT NULL;
ALTER TABLE public.gyms ALTER COLUMN brand_color SET NOT NULL;
ALTER TABLE public.gyms ALTER COLUMN business_hours SET NOT NULL;
ALTER TABLE public.gyms ALTER COLUMN working_days SET NOT NULL;
ALTER TABLE public.gyms ALTER COLUMN timezone SET NOT NULL;
ALTER TABLE public.gyms ALTER COLUMN invoice_prefix SET NOT NULL;
ALTER TABLE public.gyms ALTER COLUMN invoice_year SET NOT NULL;
ALTER TABLE public.gyms ALTER COLUMN invoice_counter SET NOT NULL;
ALTER TABLE public.gyms ALTER COLUMN gst_inclusive SET NOT NULL;
ALTER TABLE public.gyms ALTER COLUMN is_active SET NOT NULL;
ALTER TABLE public.gyms ALTER COLUMN settings SET NOT NULL;
ALTER TABLE public.gyms ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE public.gyms ALTER COLUMN updated_at SET NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN is_super_admin SET NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN updated_at SET NOT NULL;
ALTER TABLE public.gym_members ALTER COLUMN id SET NOT NULL;
ALTER TABLE public.gym_members ALTER COLUMN role SET NOT NULL;
ALTER TABLE public.gym_members ALTER COLUMN qr_secret SET NOT NULL;
ALTER TABLE public.gym_members ALTER COLUMN is_active SET NOT NULL;
ALTER TABLE public.gym_members ALTER COLUMN joined_at SET NOT NULL;
ALTER TABLE public.gym_members ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE public.gym_members ALTER COLUMN updated_at SET NOT NULL;
ALTER TABLE public.membership_plans ALTER COLUMN id SET NOT NULL;
ALTER TABLE public.membership_plans ALTER COLUMN features SET NOT NULL;
ALTER TABLE public.membership_plans ALTER COLUMN allow_future_start SET NOT NULL;
ALTER TABLE public.membership_plans ALTER COLUMN is_active SET NOT NULL;
ALTER TABLE public.membership_plans ALTER COLUMN sort_order SET NOT NULL;
ALTER TABLE public.membership_plans ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE public.membership_plans ALTER COLUMN updated_at SET NOT NULL;
ALTER TABLE public.promo_codes ALTER COLUMN id SET NOT NULL;
ALTER TABLE public.promo_codes ALTER COLUMN used_count SET NOT NULL;
ALTER TABLE public.promo_codes ALTER COLUMN valid_from SET NOT NULL;
ALTER TABLE public.promo_codes ALTER COLUMN is_active SET NOT NULL;
ALTER TABLE public.promo_codes ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE public.payments ALTER COLUMN id SET NOT NULL;
ALTER TABLE public.payments ALTER COLUMN discount_amount SET NOT NULL;
ALTER TABLE public.payments ALTER COLUMN gst_rate SET NOT NULL;
ALTER TABLE public.payments ALTER COLUMN currency SET NOT NULL;
ALTER TABLE public.payments ALTER COLUMN status SET NOT NULL;
ALTER TABLE public.payments ALTER COLUMN metadata SET NOT NULL;
ALTER TABLE public.payments ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE public.payments ALTER COLUMN updated_at SET NOT NULL;
ALTER TABLE public.memberships ALTER COLUMN id SET NOT NULL;
ALTER TABLE public.memberships ALTER COLUMN status SET NOT NULL;
ALTER TABLE public.memberships ALTER COLUMN freeze_count SET NOT NULL;
ALTER TABLE public.memberships ALTER COLUMN total_freeze_days SET NOT NULL;
ALTER TABLE public.memberships ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE public.memberships ALTER COLUMN updated_at SET NOT NULL;
ALTER TABLE public.membership_freezes ALTER COLUMN id SET NOT NULL;
ALTER TABLE public.membership_freezes ALTER COLUMN frozen_at SET NOT NULL;
ALTER TABLE public.membership_freezes ALTER COLUMN resumed_early SET NOT NULL;
ALTER TABLE public.membership_freezes ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE public.membership_events ALTER COLUMN id SET NOT NULL;
ALTER TABLE public.membership_events ALTER COLUMN details SET NOT NULL;
ALTER TABLE public.membership_events ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE public.invoices ALTER COLUMN id SET NOT NULL;
ALTER TABLE public.invoices ALTER COLUMN invoice_date SET NOT NULL;
ALTER TABLE public.invoices ALTER COLUMN discount_amount SET NOT NULL;
ALTER TABLE public.invoices ALTER COLUMN cgst_rate SET NOT NULL;
ALTER TABLE public.invoices ALTER COLUMN sgst_rate SET NOT NULL;
ALTER TABLE public.invoices ALTER COLUMN payment_method SET NOT NULL;
ALTER TABLE public.invoices ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE public.razorpay_webhook_events ALTER COLUMN id SET NOT NULL;
ALTER TABLE public.razorpay_webhook_events ALTER COLUMN processed SET NOT NULL;
ALTER TABLE public.razorpay_webhook_events ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE public.credit_notes ALTER COLUMN id SET NOT NULL;
ALTER TABLE public.credit_notes ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE public.access_devices ALTER COLUMN id SET NOT NULL;
ALTER TABLE public.access_devices ALTER COLUMN is_active SET NOT NULL;
ALTER TABLE public.access_devices ALTER COLUMN config SET NOT NULL;
ALTER TABLE public.access_devices ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE public.attendance ALTER COLUMN id SET NOT NULL;
ALTER TABLE public.attendance ALTER COLUMN check_in_at SET NOT NULL;
ALTER TABLE public.attendance ALTER COLUMN method SET NOT NULL;
ALTER TABLE public.attendance ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE public.scan_events ALTER COLUMN id SET NOT NULL;
ALTER TABLE public.scan_events ALTER COLUMN scanned_at SET NOT NULL;
ALTER TABLE public.scan_events ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE public.gym_holidays ALTER COLUMN id SET NOT NULL;
ALTER TABLE public.gym_holidays ALTER COLUMN affects_membership SET NOT NULL;
ALTER TABLE public.gym_holidays ALTER COLUMN is_active SET NOT NULL;
ALTER TABLE public.gym_holidays ALTER COLUMN created_at SET NOT NULL;

-- ==========================================
-- SECTION 3: FUNCTIONS
-- ==========================================
-- Private policy helpers avoid RLS recursion; they never accept an arbitrary user ID.
CREATE FUNCTION private.is_super_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
 SELECT coalesce((SELECT p.is_super_admin FROM public.profiles p WHERE p.id = auth.uid()), false);
$$;
CREATE FUNCTION private.get_my_role_in_gym(p_gym_id uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
 SELECT m.role FROM public.gym_members m WHERE m.gym_id = p_gym_id AND m.profile_id = auth.uid() AND m.is_active;
$$;
CREATE FUNCTION private.get_my_gym_ids() RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
 SELECT m.gym_id FROM public.gym_members m WHERE m.profile_id = auth.uid() AND m.is_active;
$$;
CREATE FUNCTION private.is_own_member(p_member_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
 SELECT EXISTS(SELECT 1 FROM public.gym_members m WHERE m.id = p_member_id AND m.profile_id = auth.uid() AND m.is_active);
$$;
CREATE FUNCTION private.gym_is_active(p_gym_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
 SELECT coalesce((SELECT g.is_active FROM public.gyms g WHERE g.id = p_gym_id),false);
$$;
CREATE FUNCTION private.can_read_gym(p_gym_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
 SELECT private.is_super_admin() OR
 (private.get_my_role_in_gym(p_gym_id) IS NOT NULL AND
 (private.gym_is_active(p_gym_id) OR private.get_my_role_in_gym(p_gym_id) IN ('owner','admin')));
$$;
CREATE FUNCTION private.can_manage_gym(p_gym_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
 SELECT private.is_super_admin() OR (private.gym_is_active(p_gym_id) AND private.get_my_role_in_gym(p_gym_id) IN ('owner','admin'));
$$;
CREATE FUNCTION private.can_read_member(p_gym_id uuid,p_member_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
 SELECT private.can_read_gym(p_gym_id) AND (private.is_super_admin()
 OR private.get_my_role_in_gym(p_gym_id) IN ('owner','admin','receptionist')
 OR private.is_own_member(p_member_id));
$$;
CREATE FUNCTION private.can_read_profile(p_profile_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
 SELECT p_profile_id = auth.uid() OR private.is_super_admin() OR EXISTS(
 SELECT 1 FROM public.gym_members m WHERE m.profile_id = p_profile_id
 AND private.can_read_gym(m.gym_id) AND private.get_my_role_in_gym(m.gym_id) IN ('owner','admin'));
$$;
CREATE FUNCTION public.update_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;

-- Server execution only; grants in section 5 are the authorization boundary.
CREATE FUNCTION public.generate_invoice_number(p_gym_id uuid) RETURNS text
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
DECLARE g public.gyms%ROWTYPE; y integer := extract(year from now() AT TIME ZONE 'Asia/Kolkata'); n integer;
BEGIN
 SELECT * INTO STRICT g FROM public.gyms WHERE id=p_gym_id FOR UPDATE;
 n := CASE WHEN g.invoice_year=y THEN g.invoice_counter+1 ELSE 1 END;
 UPDATE public.gyms SET invoice_year=y,invoice_counter=n WHERE id=p_gym_id;
 RETURN g.invoice_prefix || '-' || y || '-' || lpad(n::text,greatest(4,length(n::text)),'0');
END; $$;

-- Compatibility entry point requested in the build prompt. Reruns in the same year
-- are a no-op; resetting a used year's counter would produce duplicate invoices.
CREATE FUNCTION public.reset_invoice_counters() RETURNS void
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
DECLARE y integer := extract(year from now() AT TIME ZONE 'Asia/Kolkata');
BEGIN
 UPDATE public.gyms SET invoice_counter=0,invoice_year=y WHERE invoice_year IS DISTINCT FROM y;
END; $$;

CREATE FUNCTION public.calculate_membership_end_date(p_start date,p_type text,p_value integer) RETURNS date
LANGUAGE plpgsql IMMUTABLE SET search_path = pg_catalog AS $$
BEGIN
 IF p_start IS NULL OR p_value IS NULL OR p_value<=0 THEN RAISE EXCEPTION 'Invalid duration'; END IF;
 IF p_type='days' THEN RETURN p_start+p_value-1;
 ELSIF p_type='months' THEN RETURN (p_start+make_interval(months=>p_value))::date-1;
 ELSIF p_type='years' THEN RETURN (p_start+make_interval(years=>p_value))::date-1;
 ELSE RAISE EXCEPTION 'Invalid duration type'; END IF;
END; $$;

CREATE FUNCTION public.sync_scheduled_renewal(p_member_id uuid) RETURNS void
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
DECLARE c public.memberships%ROWTYPE; r public.memberships%ROWTYPE; p public.membership_plans%ROWTYPE; s date;
BEGIN
 PERFORM 1 FROM public.gym_members WHERE id=p_member_id FOR UPDATE;
 SELECT * INTO c FROM public.memberships WHERE member_id=p_member_id AND status IN ('active','frozen');
 IF NOT FOUND THEN RETURN; END IF;
 SELECT * INTO r FROM public.memberships WHERE member_id=p_member_id AND status='scheduled' FOR UPDATE;
 IF NOT FOUND THEN RETURN; END IF;
 SELECT * INTO STRICT p FROM public.membership_plans WHERE id=r.plan_id;
 s:=c.end_date+1;
 IF r.start_date IS DISTINCT FROM s THEN
 UPDATE public.memberships SET start_date=s,end_date=public.calculate_membership_end_date(s,p.duration_type,p.duration_value) WHERE id=r.id;
 INSERT INTO public.membership_events(gym_id,membership_id,event_type,from_status,to_status,details)
 VALUES(r.gym_id,r.id,'extended','scheduled','scheduled',jsonb_build_object('reason','Renewal rescheduled with current membership','old_start_date',r.start_date,'new_start_date',s));
 END IF;
END; $$;

CREATE FUNCTION public.process_daily_memberships() RETURNS void
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
DECLARE today date := (now() AT TIME ZONE 'Asia/Kolkata')::date; m record; r public.memberships%ROWTYPE;
BEGIN
 FOR m IN SELECT DISTINCT member_id FROM public.memberships WHERE status IN ('active','frozen','scheduled') ORDER BY member_id LOOP
  BEGIN
   PERFORM 1 FROM public.gym_members WHERE id=m.member_id FOR UPDATE;
   -- Renewals cannot activate until the preceding current membership is expired.
   FOR r IN SELECT * FROM public.memberships WHERE member_id=m.member_id AND status='active' AND end_date<today FOR UPDATE LOOP
    UPDATE public.memberships SET status='expired' WHERE id=r.id;
    INSERT INTO public.membership_events(gym_id,membership_id,event_type,from_status,to_status) VALUES(r.gym_id,r.id,'expired','active','expired');
   END LOOP;
   FOR r IN SELECT * FROM public.memberships WHERE member_id=m.member_id AND status='frozen' AND frozen_until<=today FOR UPDATE LOOP
    -- Planned extension is applied by the freeze operation. Close its history here.
    UPDATE public.membership_freezes SET resume_at=(r.frozen_until::timestamp AT TIME ZONE 'Asia/Kolkata'),actual_days=planned_days WHERE membership_id=r.id AND resume_at IS NULL;
    UPDATE public.memberships SET status=CASE WHEN end_date<today THEN 'expired' ELSE 'active' END,frozen_at=NULL,frozen_until=NULL WHERE id=r.id;
    INSERT INTO public.membership_events(gym_id,membership_id,event_type,from_status,to_status)
    VALUES(r.gym_id,r.id,CASE WHEN r.end_date<today THEN 'expired' ELSE 'resumed' END,'frozen',CASE WHEN r.end_date<today THEN 'expired' ELSE 'active' END);
   END LOOP;
   PERFORM public.sync_scheduled_renewal(m.member_id);
   FOR r IN SELECT * FROM public.memberships WHERE member_id=m.member_id AND status='scheduled' AND start_date<=today FOR UPDATE LOOP
    IF EXISTS(SELECT 1 FROM public.memberships WHERE member_id=m.member_id AND status IN ('active','frozen')) THEN CONTINUE; END IF;
    UPDATE public.memberships SET status=CASE WHEN end_date<today THEN 'expired' ELSE 'active' END WHERE id=r.id;
    INSERT INTO public.membership_events(gym_id,membership_id,event_type,from_status,to_status)
    VALUES(r.gym_id,r.id,CASE WHEN r.end_date<today THEN 'expired' ELSE 'activated' END,'scheduled',CASE WHEN r.end_date<today THEN 'expired' ELSE 'active' END);
   END LOOP;
  EXCEPTION WHEN OTHERS THEN
   RAISE WARNING 'Membership processing failed for member %: %',m.member_id,SQLERRM;
  END;
 END LOOP;
END; $$;

-- The first five arguments retain the requested API. Positive captures also require
-- verified event data from the Edge Function. Never grant this RPC to authenticated.
CREATE FUNCTION public.process_payment_capture(
 p_payment_id uuid,p_razorpay_payment_id text,p_razorpay_signature text,p_plan_id uuid,p_start_date date,
 p_event_id text DEFAULT NULL,p_event_payload jsonb DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SET search_path = pg_catalog AS $$
DECLARE pay public.payments%ROWTYPE; plan public.membership_plans%ROWTYPE; g public.gyms%ROWTYPE;
 member public.gym_members%ROWTYPE; profile public.profiles%ROWTYPE; current_membership public.memberships%ROWTYPE;
 mid uuid; iid uuid; number text; s date; e date; st text; event_payment uuid; promo public.promo_codes%ROWTYPE;
 expected_discount numeric(10,2); rate numeric(4,2); half_tax numeric(10,2);
 today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
BEGIN
 -- Consistent lock order: gym -> member -> payment -> promo.
 SELECT * INTO STRICT pay FROM public.payments WHERE id=p_payment_id;
 SELECT * INTO STRICT g FROM public.gyms WHERE id=pay.gym_id FOR UPDATE;
 SELECT * INTO STRICT member FROM public.gym_members WHERE id=pay.member_id AND gym_id=pay.gym_id FOR UPDATE;
 SELECT * INTO STRICT pay FROM public.payments WHERE id=p_payment_id FOR UPDATE;
 IF pay.plan_id IS DISTINCT FROM p_plan_id OR pay.requested_start_date IS DISTINCT FROM p_start_date THEN RAISE EXCEPTION 'Checkout does not match stored payment'; END IF;
 IF pay.total_amount>0 THEN
  IF p_event_id IS NULL OR p_razorpay_payment_id IS NULL OR p_razorpay_signature IS NULL OR pay.razorpay_order_id IS NULL THEN RAISE EXCEPTION 'Verified capture event required'; END IF;
  IF p_event_payload->>'event' IS DISTINCT FROM 'payment.captured'
    OR p_event_payload#>>'{payload,payment,entity,order_id}' IS DISTINCT FROM pay.razorpay_order_id
    OR p_event_payload#>>'{payload,payment,entity,id}' IS DISTINCT FROM p_razorpay_payment_id
    OR p_event_payload#>>'{payload,payment,entity,currency}' IS DISTINCT FROM pay.currency
    OR (p_event_payload#>>'{payload,payment,entity,amount}')::numeric IS DISTINCT FROM pay.total_amount*100
  THEN RAISE EXCEPTION 'Capture payload mismatch'; END IF;
 ELSIF p_razorpay_payment_id IS NOT NULL OR p_event_id IS NOT NULL THEN RAISE EXCEPTION 'Free checkout must not have Razorpay IDs';
 END IF;
 IF p_event_id IS NOT NULL THEN
  INSERT INTO public.razorpay_webhook_events(gym_id,payment_id,event_id,event_type,payload)
  VALUES(pay.gym_id,pay.id,p_event_id,'payment.captured',p_event_payload) ON CONFLICT(event_id) DO NOTHING;
  SELECT payment_id INTO event_payment FROM public.razorpay_webhook_events WHERE event_id=p_event_id FOR UPDATE;
  IF event_payment<>pay.id THEN RAISE EXCEPTION 'Event belongs to another payment'; END IF;
 END IF;
 IF pay.status='captured' THEN
  IF pay.razorpay_payment_id IS DISTINCT FROM p_razorpay_payment_id THEN RAISE EXCEPTION 'Capture ID mismatch'; END IF;
  SELECT id,invoice_number INTO STRICT iid,number FROM public.invoices WHERE payment_id=pay.id;
  SELECT id INTO STRICT mid FROM public.memberships WHERE payment_id=pay.id;
  UPDATE public.razorpay_webhook_events SET processed=true,processed_at=now() WHERE event_id=p_event_id;
  RETURN jsonb_build_object('already_processed',true,'membership_id',mid,'invoice_id',iid,'invoice_number',number);
 END IF;
 SELECT * INTO STRICT plan FROM public.membership_plans WHERE id=pay.plan_id AND gym_id=pay.gym_id;
 SELECT * INTO STRICT profile FROM public.profiles WHERE id=member.profile_id;
 -- Pricing is a server-created checkout snapshot. Never use incoming client amounts.
 rate:=CASE WHEN nullif(trim(g.gstin),'') IS NULL THEN 0 ELSE 5 END;
 IF pay.gst_rate<>rate THEN RAISE EXCEPTION 'GST configuration mismatch'; END IF;
 half_tax:=round(pay.taxable_amount*rate/200,2);
 IF pay.cgst_amount<>half_tax OR pay.sgst_amount<>half_tax THEN RAISE EXCEPTION 'Tax calculation mismatch'; END IF;
 IF pay.promo_code_id IS NOT NULL THEN
  SELECT * INTO STRICT promo FROM public.promo_codes WHERE id=pay.promo_code_id AND gym_id=pay.gym_id FOR UPDATE;
  IF promo.max_uses IS NOT NULL AND promo.used_count>=promo.max_uses THEN RAISE EXCEPTION 'Promo usage exhausted; reconcile captured payment'; END IF;
  IF NOT promo.is_active OR pay.created_at<promo.valid_from OR (promo.valid_until IS NOT NULL AND pay.created_at>promo.valid_until) THEN RAISE EXCEPTION 'Invalid promo snapshot'; END IF;
  IF promo.applicable_plan_ids IS NOT NULL AND NOT promo.applicable_plan_ids @> jsonb_build_array(plan.id::text) THEN RAISE EXCEPTION 'Promo not applicable to plan'; END IF;
  expected_discount:=CASE WHEN promo.discount_type='percentage' THEN round(pay.amount*promo.discount_value/100,2) ELSE promo.discount_value END;
  IF promo.max_discount_amount IS NOT NULL THEN expected_discount:=least(expected_discount,promo.max_discount_amount); END IF;
  IF pay.discount_amount<>least(pay.amount,expected_discount) THEN RAISE EXCEPTION 'Promo amount mismatch'; END IF;
 END IF;
 -- Paid money must be accounted for even if a gym is disabled while checkout is open.
 -- RLS still blocks member access while disabled. New orders must be refused upstream.
 FOR current_membership IN SELECT * FROM public.memberships WHERE member_id=member.id AND status='active' AND end_date<today FOR UPDATE LOOP
  UPDATE public.memberships SET status='expired' WHERE id=current_membership.id;
  INSERT INTO public.membership_events(gym_id,membership_id,event_type,from_status,to_status) VALUES(pay.gym_id,current_membership.id,'expired','active','expired');
 END LOOP;
 SELECT * INTO current_membership FROM public.memberships WHERE member_id=member.id AND status IN ('active','frozen') FOR UPDATE;
 s:=greatest(p_start_date,today);
 IF current_membership.id IS NOT NULL THEN
  IF pay.metadata->>'purchase_mode'='upgrade' THEN
   IF EXISTS(SELECT 1 FROM public.memberships WHERE member_id=member.id AND status='scheduled') THEN RAISE EXCEPTION 'Cancel scheduled renewal before upgrading'; END IF;
   UPDATE public.memberships SET status='cancelled',cancelled_at=now(),cancelled_by=pay.created_by,cancellation_reason='Upgraded' WHERE id=current_membership.id;
   INSERT INTO public.membership_events(gym_id,membership_id,event_type,from_status,to_status,performed_by)
    VALUES(pay.gym_id,current_membership.id,'upgraded',current_membership.status,'cancelled',pay.created_by);
   s:=today;
  ELSE s:=current_membership.end_date+1;
  END IF;
 END IF;
 IF EXISTS(SELECT 1 FROM public.memberships WHERE member_id=member.id AND status='scheduled') THEN RAISE EXCEPTION 'Scheduled renewal already exists; reconcile captured payment'; END IF;
 e:=public.calculate_membership_end_date(s,coalesce(pay.metadata->>'duration_type',plan.duration_type),coalesce((pay.metadata->>'duration_value')::integer,plan.duration_value));
 st:=CASE WHEN s>today THEN 'scheduled' ELSE 'active' END;
 UPDATE public.payments SET status='captured',razorpay_payment_id=p_razorpay_payment_id,razorpay_signature=p_razorpay_signature WHERE id=pay.id;
 INSERT INTO public.memberships(gym_id,member_id,plan_id,payment_id,status,start_date,end_date,original_end_date,created_by)
 VALUES(pay.gym_id,member.id,plan.id,pay.id,st,s,e,e,pay.created_by) RETURNING id INTO mid;
 INSERT INTO public.membership_events(gym_id,membership_id,event_type,to_status,performed_by,details)
 VALUES(pay.gym_id,mid,'created',st,pay.created_by,jsonb_build_object('payment_id',pay.id));
 number:=public.generate_invoice_number(pay.gym_id);
 INSERT INTO public.invoices(gym_id,member_id,payment_id,invoice_number,gym_name,gym_address,gym_gstin,member_name,member_phone,items,subtotal,discount_amount,taxable_amount,cgst_rate,cgst_amount,sgst_rate,sgst_amount,total_amount,payment_method,payment_ref)
 VALUES(pay.gym_id,member.id,pay.id,number,g.name,g.address,g.gstin,profile.full_name,profile.phone,
 jsonb_build_array(jsonb_build_object('description',coalesce(pay.description,plan.name),'sac_code','999723','qty',1,'rate',pay.amount,'amount',pay.amount)),
 pay.amount,pay.discount_amount,pay.taxable_amount,rate/2,pay.cgst_amount,rate/2,pay.sgst_amount,pay.total_amount,
 CASE WHEN pay.total_amount=0 THEN 'free' ELSE 'online' END,p_razorpay_payment_id) RETURNING id INTO iid;
 IF pay.promo_code_id IS NOT NULL THEN UPDATE public.promo_codes SET used_count=used_count+1 WHERE id=pay.promo_code_id; END IF;
 UPDATE public.razorpay_webhook_events SET processed=true,processed_at=now() WHERE event_id=p_event_id;
 RETURN jsonb_build_object('success',true,'membership_id',mid,'invoice_id',iid,'invoice_number',number);
END; $$;

-- Tenant-scoped directory safely exposes minimal profile fields to reception.
CREATE FUNCTION private.get_member_directory(p_gym_id uuid)
RETURNS TABLE(member_id uuid,full_name text,phone text,member_code text,is_active boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT (private.is_super_admin() OR
 (private.can_read_gym(p_gym_id) AND private.get_my_role_in_gym(p_gym_id) IN ('owner','admin','receptionist')))
 THEN RAISE EXCEPTION 'Permission denied' USING ERRCODE='42501'; END IF;
 RETURN QUERY SELECT m.id,p.full_name,p.phone,m.member_code,m.is_active
 FROM public.gym_members m JOIN public.profiles p ON p.id=m.profile_id WHERE m.gym_id=p_gym_id;
END; $$;

-- Public RPC is an invoker wrapper; privileged implementation is not exposed.
CREATE FUNCTION public.get_member_directory(p_gym_id uuid)
RETURNS TABLE(member_id uuid,full_name text,phone text,member_code text,is_active boolean)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $$
 SELECT * FROM private.get_member_directory(p_gym_id);
$$;

-- ==========================================
-- SECTION 4: TRIGGERS
-- ==========================================
CREATE TRIGGER tr_gyms_updated_at BEFORE UPDATE ON public.gyms FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER tr_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER tr_gym_members_updated_at BEFORE UPDATE ON public.gym_members FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER tr_membership_plans_updated_at BEFORE UPDATE ON public.membership_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER tr_memberships_updated_at BEFORE UPDATE ON public.memberships FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER tr_payments_updated_at BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE FUNCTION private.guard_protected_fields() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
 IF TG_TABLE_NAME='gyms' THEN
  IF NEW.slug IS DISTINCT FROM OLD.slug THEN RAISE EXCEPTION 'Gym slug is permanent'; END IF;
 END IF;
 -- SQL Editor and service-role functions are trusted; user operations use grants/RLS.
 IF current_user IN ('postgres','service_role') THEN RETURN NEW; END IF;
 IF TG_TABLE_NAME='profiles' THEN
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.phone IS DISTINCT FROM OLD.phone OR NEW.is_super_admin IS DISTINCT FROM OLD.is_super_admin THEN RAISE EXCEPTION 'Protected profile fields'; END IF;
 ELSIF TG_TABLE_NAME='gym_members' THEN
  IF NEW.gym_id IS DISTINCT FROM OLD.gym_id OR NEW.profile_id IS DISTINCT FROM OLD.profile_id OR NEW.role IS DISTINCT FROM OLD.role OR NEW.qr_secret IS DISTINCT FROM OLD.qr_secret THEN RAISE EXCEPTION 'Use authorized staff-management endpoint'; END IF;
 ELSIF TG_TABLE_NAME='gyms' THEN
  IF NEW.is_active IS DISTINCT FROM OLD.is_active OR NEW.razorpay_key_id_enc IS DISTINCT FROM OLD.razorpay_key_id_enc OR NEW.razorpay_key_secret_enc IS DISTINCT FROM OLD.razorpay_key_secret_enc OR NEW.razorpay_webhook_secret_enc IS DISTINCT FROM OLD.razorpay_webhook_secret_enc THEN RAISE EXCEPTION 'Protected gym settings'; END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER tr_profiles_protected BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION private.guard_protected_fields();
CREATE TRIGGER tr_members_protected BEFORE UPDATE ON public.gym_members FOR EACH ROW EXECUTE FUNCTION private.guard_protected_fields();
CREATE TRIGGER tr_gyms_protected BEFORE UPDATE ON public.gyms FOR EACH ROW EXECUTE FUNCTION private.guard_protected_fields();
CREATE FUNCTION private.prevent_invoice_mutation() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN RAISE EXCEPTION 'Issued invoices are immutable; issue a credit note'; END; $$;
CREATE TRIGGER tr_invoice_immutable BEFORE UPDATE OR DELETE ON public.invoices FOR EACH ROW EXECUTE FUNCTION private.prevent_invoice_mutation();

-- ==========================================
-- SECTION 5: ROW LEVEL SECURITY AND GRANTS
-- ==========================================
ALTER TABLE public.gyms ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.gyms FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.gyms TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.profiles FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.gym_members ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.gym_members FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.gym_members TO service_role;
ALTER TABLE public.membership_plans ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.membership_plans FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.membership_plans TO service_role;
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.promo_codes FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.promo_codes TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payments FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.memberships FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.memberships TO service_role;
ALTER TABLE public.membership_freezes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.membership_freezes FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.membership_freezes TO service_role;
ALTER TABLE public.membership_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.membership_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.membership_events TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.invoices FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.razorpay_webhook_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.razorpay_webhook_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.razorpay_webhook_events TO service_role;
ALTER TABLE public.credit_notes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.credit_notes FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.credit_notes TO service_role;
ALTER TABLE public.access_devices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.access_devices FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.access_devices TO service_role;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.attendance FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.attendance TO service_role;
ALTER TABLE public.scan_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.scan_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.scan_events TO service_role;
ALTER TABLE public.gym_holidays ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.gym_holidays FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.gym_holidays TO service_role;
GRANT USAGE ON SCHEMA public TO authenticated,service_role;
-- Restrict function execution explicitly; CREATE FUNCTION otherwise grants PUBLIC.
REVOKE ALL ON FUNCTION private.is_super_admin() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.is_super_admin() TO authenticated,service_role;
REVOKE ALL ON FUNCTION private.get_my_role_in_gym(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.get_my_role_in_gym(uuid) TO authenticated,service_role;
REVOKE ALL ON FUNCTION private.get_my_gym_ids() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.get_my_gym_ids() TO authenticated,service_role;
REVOKE ALL ON FUNCTION private.is_own_member(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.is_own_member(uuid) TO authenticated,service_role;
REVOKE ALL ON FUNCTION private.gym_is_active(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.gym_is_active(uuid) TO authenticated,service_role;
REVOKE ALL ON FUNCTION private.can_read_gym(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.can_read_gym(uuid) TO authenticated,service_role;
REVOKE ALL ON FUNCTION private.can_manage_gym(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.can_manage_gym(uuid) TO authenticated,service_role;
REVOKE ALL ON FUNCTION private.can_read_member(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.can_read_member(uuid,uuid) TO authenticated,service_role;
REVOKE ALL ON FUNCTION private.can_read_profile(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.can_read_profile(uuid) TO authenticated,service_role;
REVOKE ALL ON FUNCTION private.guard_protected_fields() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION private.prevent_invoice_mutation() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.update_updated_at() TO service_role;
REVOKE ALL ON FUNCTION public.generate_invoice_number(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.generate_invoice_number(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.reset_invoice_counters() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reset_invoice_counters() TO service_role;
REVOKE ALL ON FUNCTION public.calculate_membership_end_date(date,text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_membership_end_date(date,text,integer) TO service_role;
REVOKE ALL ON FUNCTION public.sync_scheduled_renewal(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sync_scheduled_renewal(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.process_daily_memberships() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.process_daily_memberships() TO service_role;
REVOKE ALL ON FUNCTION public.process_payment_capture(uuid,text,text,uuid,date,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.process_payment_capture(uuid,text,text,uuid,date,text,jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.get_member_directory(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_member_directory(uuid) TO authenticated,service_role;
REVOKE ALL ON FUNCTION private.get_member_directory(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.get_member_directory(uuid) TO authenticated,service_role;
GRANT SELECT (id,name,slug,logo_url,brand_color,brand_color_secondary,address,city,state,pincode,phone,email,website,gstin,business_hours,working_days,timezone,invoice_prefix,invoice_year,invoice_counter,gst_inclusive,is_active,settings,created_at,updated_at) ON public.gyms TO authenticated;
GRANT SELECT (id,gym_id,profile_id,role,member_code,is_active,joined_at,created_at,updated_at) ON public.gym_members TO authenticated;
GRANT SELECT (id,gym_id,member_id,plan_id,requested_start_date,amount,discount_amount,taxable_amount,gst_rate,cgst_amount,sgst_amount,total_amount,currency,razorpay_order_id,razorpay_payment_id,status,promo_code_id,description,created_by,created_at,updated_at) ON public.payments TO authenticated;
GRANT SELECT ON public.profiles TO authenticated;
GRANT SELECT ON public.membership_plans TO authenticated;
GRANT SELECT ON public.promo_codes TO authenticated;
GRANT SELECT ON public.memberships TO authenticated;
GRANT SELECT ON public.membership_freezes TO authenticated;
GRANT SELECT ON public.membership_events TO authenticated;
GRANT SELECT ON public.invoices TO authenticated;
GRANT SELECT ON public.credit_notes TO authenticated;
GRANT SELECT ON public.access_devices TO authenticated;
GRANT SELECT ON public.attendance TO authenticated;
GRANT SELECT ON public.gym_holidays TO authenticated;
GRANT SELECT (id,gym_id,member_id,scanned_at,result,denial_reason,override_by,override_reason,device_id,created_at) ON public.scan_events TO authenticated;
GRANT UPDATE(full_name,email,avatar_url,date_of_birth,gender,address,emergency_contact_name,emergency_contact_phone) ON public.profiles TO authenticated;
GRANT UPDATE(name,logo_url,brand_color,brand_color_secondary,address,city,state,pincode,phone,email,website,gstin,business_hours,working_days,invoice_prefix) ON public.gyms TO authenticated;
GRANT UPDATE(member_code) ON public.gym_members TO authenticated;
GRANT INSERT (gym_id,name,description,price,duration_type,duration_value,features,max_freezes,max_freeze_days,allow_future_start,is_active,sort_order,created_by) ON public.membership_plans TO authenticated;
GRANT UPDATE (name,description,price,duration_type,duration_value,features,max_freezes,max_freeze_days,allow_future_start,is_active,sort_order) ON public.membership_plans TO authenticated;
GRANT INSERT (gym_id,code,discount_type,discount_value,max_discount_amount,max_uses,valid_from,valid_until,applicable_plan_ids,is_active,created_by) ON public.promo_codes TO authenticated;
GRANT UPDATE (code,discount_type,discount_value,max_discount_amount,max_uses,valid_from,valid_until,applicable_plan_ids,is_active) ON public.promo_codes TO authenticated;
GRANT INSERT (gym_id,name,type,location,is_active,config) ON public.access_devices TO authenticated;
GRANT UPDATE (name,type,location,is_active,config) ON public.access_devices TO authenticated;
GRANT INSERT (gym_id,name,date,reason,affects_membership,is_active,created_by) ON public.gym_holidays TO authenticated;
GRANT UPDATE (name,date,reason,is_active) ON public.gym_holidays TO authenticated;

CREATE POLICY profiles_select ON public.profiles FOR SELECT TO authenticated USING(private.can_read_profile(id));
CREATE POLICY profiles_update ON public.profiles FOR UPDATE TO authenticated USING(id=auth.uid()) WITH CHECK(id=auth.uid());
CREATE POLICY gyms_select ON public.gyms FOR SELECT TO authenticated USING(private.can_read_gym(id));
CREATE POLICY gyms_update ON public.gyms FOR UPDATE TO authenticated USING(private.can_manage_gym(id)) WITH CHECK(private.can_manage_gym(id));
CREATE POLICY gym_members_select ON public.gym_members FOR SELECT TO authenticated USING(private.can_read_member(gym_id,id));
CREATE POLICY gym_members_update ON public.gym_members FOR UPDATE TO authenticated
 USING(private.can_read_gym(gym_id) AND private.gym_is_active(gym_id) AND (private.is_super_admin() OR private.get_my_role_in_gym(gym_id) IN ('owner','admin','receptionist')))
 WITH CHECK(private.can_read_gym(gym_id) AND private.gym_is_active(gym_id) AND (private.is_super_admin() OR private.get_my_role_in_gym(gym_id) IN ('owner','admin','receptionist')));
CREATE POLICY memberships_select ON public.memberships FOR SELECT TO authenticated USING(private.can_read_member(gym_id,member_id));
CREATE POLICY payments_select ON public.payments FOR SELECT TO authenticated USING(private.can_read_member(gym_id,member_id));
CREATE POLICY invoices_select ON public.invoices FOR SELECT TO authenticated USING(private.can_read_member(gym_id,member_id));
CREATE POLICY attendance_select ON public.attendance FOR SELECT TO authenticated USING(private.can_read_member(gym_id,member_id));
CREATE POLICY membership_freezes_select ON public.membership_freezes FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.memberships m WHERE m.id=membership_id AND m.gym_id=membership_freezes.gym_id AND private.can_read_member(m.gym_id,m.member_id)));
CREATE POLICY membership_events_select ON public.membership_events FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.memberships m WHERE m.id=membership_id AND m.gym_id=membership_events.gym_id AND private.can_read_member(m.gym_id,m.member_id)));
CREATE POLICY credit_notes_select ON public.credit_notes FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.invoices i WHERE i.id=invoice_id AND i.gym_id=credit_notes.gym_id AND private.can_read_member(i.gym_id,i.member_id)));
CREATE POLICY plans_select ON public.membership_plans FOR SELECT TO authenticated USING(private.can_read_gym(gym_id) AND (is_active OR private.is_super_admin() OR private.get_my_role_in_gym(gym_id) IN ('owner','admin','receptionist')));
CREATE POLICY promos_select ON public.promo_codes FOR SELECT TO authenticated USING(private.can_read_gym(gym_id) AND (private.is_super_admin() OR private.get_my_role_in_gym(gym_id) IN ('owner','admin')));
CREATE POLICY devices_select ON public.access_devices FOR SELECT TO authenticated USING(private.can_read_gym(gym_id) AND (private.is_super_admin() OR private.get_my_role_in_gym(gym_id) IN ('owner','admin','receptionist')));
CREATE POLICY holidays_select ON public.gym_holidays FOR SELECT TO authenticated USING(private.can_read_gym(gym_id));
CREATE POLICY scans_select ON public.scan_events FOR SELECT TO authenticated USING(private.can_read_gym(gym_id) AND (private.is_super_admin() OR private.get_my_role_in_gym(gym_id) IN ('owner','admin')));
-- Webhook payloads are server-only; no browser SELECT grant or policy.
CREATE POLICY membership_plans_insert ON public.membership_plans FOR INSERT TO authenticated WITH CHECK(private.can_manage_gym(gym_id) AND (created_by IS NULL OR private.is_own_member(created_by)));
CREATE POLICY membership_plans_update ON public.membership_plans FOR UPDATE TO authenticated USING(private.can_manage_gym(gym_id)) WITH CHECK(private.can_manage_gym(gym_id));
CREATE POLICY promo_codes_insert ON public.promo_codes FOR INSERT TO authenticated WITH CHECK(private.can_manage_gym(gym_id) AND (created_by IS NULL OR private.is_own_member(created_by)));
CREATE POLICY promo_codes_update ON public.promo_codes FOR UPDATE TO authenticated USING(private.can_manage_gym(gym_id)) WITH CHECK(private.can_manage_gym(gym_id));
CREATE POLICY access_devices_insert ON public.access_devices FOR INSERT TO authenticated WITH CHECK(private.can_manage_gym(gym_id));
CREATE POLICY access_devices_update ON public.access_devices FOR UPDATE TO authenticated USING(private.can_manage_gym(gym_id)) WITH CHECK(private.can_manage_gym(gym_id));
CREATE POLICY gym_holidays_insert ON public.gym_holidays FOR INSERT TO authenticated WITH CHECK(private.can_manage_gym(gym_id) AND (created_by IS NULL OR private.is_own_member(created_by)));
CREATE POLICY gym_holidays_update ON public.gym_holidays FOR UPDATE TO authenticated USING(private.can_manage_gym(gym_id)) WITH CHECK(private.can_manage_gym(gym_id));

-- No direct financial/lifecycle/audit INSERT/UPDATE/DELETE grants. Those actions
-- are performed by authenticated Edge Functions after checking user permissions.
-- Super-admin operations on protected fields also go through those server endpoints.

-- ==========================================
-- SECTION 6: INDEXES
-- ==========================================
CREATE UNIQUE INDEX idx_membership_current ON public.memberships(gym_id,member_id) WHERE status IN ('active','frozen');
CREATE UNIQUE INDEX idx_membership_scheduled ON public.memberships(gym_id,member_id) WHERE status='scheduled';
CREATE UNIQUE INDEX idx_membership_payment ON public.memberships(payment_id) WHERE payment_id IS NOT NULL;
CREATE UNIQUE INDEX idx_invoice_payment ON public.invoices(payment_id);
CREATE UNIQUE INDEX idx_payments_rp_order ON public.payments(razorpay_order_id) WHERE razorpay_order_id IS NOT NULL;
CREATE UNIQUE INDEX idx_payments_rp_payment ON public.payments(razorpay_payment_id) WHERE razorpay_payment_id IS NOT NULL;
CREATE UNIQUE INDEX idx_member_code ON public.gym_members(gym_id,member_code) WHERE member_code IS NOT NULL;
CREATE INDEX idx_gym_members_gym ON public.gym_members(gym_id);
CREATE INDEX idx_gym_members_profile ON public.gym_members(profile_id);
CREATE INDEX idx_memberships_member ON public.memberships(member_id);
CREATE INDEX idx_memberships_status ON public.memberships(gym_id,status);
CREATE INDEX idx_payments_gym ON public.payments(gym_id);
CREATE INDEX idx_payments_member ON public.payments(member_id);
CREATE INDEX idx_payments_status ON public.payments(gym_id,status);
CREATE INDEX idx_attendance_gym_date ON public.attendance(gym_id,check_in_at);
CREATE INDEX idx_attendance_member ON public.attendance(member_id);
CREATE INDEX idx_invoices_gym ON public.invoices(gym_id);
CREATE INDEX idx_membership_events_membership ON public.membership_events(membership_id);
CREATE INDEX idx_scan_events_gym ON public.scan_events(gym_id);
CREATE INDEX idx_gym_holidays_gym_date ON public.gym_holidays(gym_id,date);

-- After enabling pg_cron in the dashboard, schedule as postgres:
-- SELECT cron.schedule('fitstack-memberships', '35 18 * * *', 'SELECT public.process_daily_memberships()');
-- 18:35 UTC = 00:05 IST. The invoice allocator handles year rollover itself.
NOTIFY pgrst, 'reload schema';
COMMIT;
