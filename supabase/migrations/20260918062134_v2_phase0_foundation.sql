-- V2 Phase 0. Additive to V1; issued invoices and V1 payment functions stay intact.
BEGIN;

ALTER TABLE public.gym_members
  ADD COLUMN date_of_birth date,
  ADD COLUMN base_salary numeric(10,2) NOT NULL DEFAULT 0 CHECK (base_salary >= 0 AND base_salary < 'Infinity'::numeric),
  ADD COLUMN commission_rate numeric(5,2) NOT NULL DEFAULT 0 CHECK (commission_rate BETWEEN 0 AND 100);
-- Existing table grants are column-specific. Payroll is intentionally NOT granted.
GRANT SELECT (date_of_birth), UPDATE (date_of_birth) ON public.gym_members TO authenticated;
UPDATE public.gym_members gm SET date_of_birth = p.date_of_birth
FROM public.profiles p WHERE p.id = gm.profile_id AND p.date_of_birth IS NOT NULL;

CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id uuid NOT NULL REFERENCES public.gyms(id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  phone text, email text,
  source text NOT NULL CHECK (source IN ('walk_in','google','instagram','whatsapp','phone','referral','self_serve')),
  convertibility text NOT NULL DEFAULT 'cold' CHECK (convertibility IN ('hot','warm','cold','others')),
  stage text NOT NULL DEFAULT 'new' CHECK (stage IN ('new','qualified','follow_up','trial_booked','trial_attended','negotiating','converted','lost')),
  assigned_to uuid, notes text, converted_member_id uuid,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (gym_id,id),
  FOREIGN KEY (gym_id,assigned_to) REFERENCES public.gym_members(gym_id,id),
  FOREIGN KEY (gym_id,converted_member_id) REFERENCES public.gym_members(gym_id,id),
  FOREIGN KEY (gym_id,created_by) REFERENCES public.gym_members(gym_id,id),
  CHECK ((stage = 'converted') = (converted_member_id IS NOT NULL))
);

CREATE TABLE public.lead_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id uuid NOT NULL REFERENCES public.gyms(id) ON DELETE RESTRICT,
  lead_id uuid NOT NULL,
  activity_type text NOT NULL CHECK (activity_type IN ('call','whatsapp_message','visit','note','stage_change','follow_up_created')),
  notes text, metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid, created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (gym_id,lead_id) REFERENCES public.leads(gym_id,id),
  FOREIGN KEY (gym_id,created_by) REFERENCES public.gym_members(gym_id,id)
);

CREATE TABLE public.staff_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id uuid NOT NULL REFERENCES public.gyms(id) ON DELETE RESTRICT,
  staff_member_id uuid NOT NULL,
  date date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Kolkata')::date,
  check_in_at timestamptz, check_out_at timestamptz,
  status text NOT NULL DEFAULT 'present' CHECK (status IN ('present','absent','half_day','leave')),
  notes text, marked_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (gym_id,staff_member_id,date),
  FOREIGN KEY (gym_id,staff_member_id) REFERENCES public.gym_members(gym_id,id),
  FOREIGN KEY (gym_id,marked_by) REFERENCES public.gym_members(gym_id,id),
  CHECK (check_out_at IS NULL OR (check_in_at IS NOT NULL AND check_out_at >= check_in_at)),
  CHECK (status NOT IN ('absent','leave') OR (check_in_at IS NULL AND check_out_at IS NULL))
);

CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id uuid NOT NULL REFERENCES public.gyms(id) ON DELETE RESTRICT,
  category text NOT NULL CHECK (category IN ('rent','utilities','equipment','salary','marketing','maintenance','supplies','staff_welfare','other')),
  amount numeric(10,2) NOT NULL CHECK (amount > 0 AND amount < 'Infinity'::numeric),
  description text NOT NULL CHECK (length(btrim(description)) > 0),
  expense_date date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Kolkata')::date,
  receipt_url text, is_active boolean NOT NULL DEFAULT true, created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (gym_id,created_by) REFERENCES public.gym_members(gym_id,id)
);

CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id uuid NOT NULL REFERENCES public.gyms(id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (length(btrim(name)) > 0), description text,
  price numeric(10,2) NOT NULL CHECK (price >= 0 AND price < 'Infinity'::numeric),
  category text NOT NULL DEFAULT 'supplement' CHECK (category IN ('supplement','merchandise','equipment','food_beverage','other')),
  stock_quantity integer CHECK (stock_quantity >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (gym_id,id)
);

-- Pending bills are separate from immutable, issued tax invoices.
CREATE TABLE public.bill_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id uuid NOT NULL REFERENCES public.gyms(id) ON DELETE RESTRICT,
  member_id uuid,
  customer_name text NOT NULL CHECK (length(btrim(customer_name)) > 0),
  customer_phone text, customer_email text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending','paid','cancelled')),
  invoice_date date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Kolkata')::date,
  due_date date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Kolkata')::date + 7,
  sold_by uuid NOT NULL, created_by uuid NOT NULL,
  gst_enabled boolean NOT NULL DEFAULT true,
  subtotal numeric(12,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0 AND subtotal < 'Infinity'::numeric),
  discount_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  taxable_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (taxable_amount >= 0),
  gst_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (gst_amount >= 0),
  total_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  currency text NOT NULL DEFAULT 'INR' CHECK (currency='INR'),
  request_key uuid NOT NULL DEFAULT gen_random_uuid(), notes text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (gym_id,id), UNIQUE (gym_id,request_key),
  FOREIGN KEY (gym_id,member_id) REFERENCES public.gym_members(gym_id,id),
  FOREIGN KEY (gym_id,sold_by) REFERENCES public.gym_members(gym_id,id),
  FOREIGN KEY (gym_id,created_by) REFERENCES public.gym_members(gym_id,id),
  CHECK (taxable_amount = subtotal - discount_amount),
  CHECK (total_amount = taxable_amount + gst_amount),
  CHECK (gst_amount = CASE WHEN gst_enabled THEN round(taxable_amount * 0.025,2) * 2 ELSE 0 END)
);

CREATE TABLE public.bill_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id uuid NOT NULL REFERENCES public.gyms(id) ON DELETE RESTRICT,
  bill_order_id uuid NOT NULL,
  item_type text NOT NULL CHECK (item_type IN ('membership_plan','product','service','other_charge')),
  item_id uuid,
  plan_id uuid GENERATED ALWAYS AS (CASE WHEN item_type='membership_plan' THEN item_id END) STORED,
  product_id uuid GENERATED ALWAYS AS (CASE WHEN item_type='product' THEN item_id END) STORED,
  requested_start_date date,
  description text NOT NULL CHECK (length(btrim(description)) > 0),
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price numeric(10,2) NOT NULL CHECK (unit_price >= 0 AND unit_price < 'Infinity'::numeric),
  discount_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  taxable_amount numeric(12,2) NOT NULL CHECK (taxable_amount >= 0),
  gst_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (gst_amount >= 0),
  total_amount numeric(12,2) NOT NULL CHECK (total_amount >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (gym_id,bill_order_id) REFERENCES public.bill_orders(gym_id,id),
  FOREIGN KEY (gym_id,plan_id) REFERENCES public.membership_plans(gym_id,id),
  FOREIGN KEY (gym_id,product_id) REFERENCES public.products(gym_id,id),
  CHECK ((item_type IN ('membership_plan','product')) = (item_id IS NOT NULL)),
  CHECK ((item_type='membership_plan' AND quantity=1 AND requested_start_date IS NOT NULL) OR (item_type<>'membership_plan' AND requested_start_date IS NULL)),
  CHECK (taxable_amount = quantity * unit_price - discount_amount),
  CHECK (total_amount = taxable_amount + gst_amount)
);
CREATE UNIQUE INDEX bill_order_one_membership ON public.bill_order_items(gym_id,bill_order_id) WHERE item_type='membership_plan';

CREATE TABLE public.bill_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id uuid NOT NULL REFERENCES public.gyms(id) ON DELETE RESTRICT,
  bill_order_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'created' CHECK (status IN ('created','captured','failed')),
  amount numeric(12,2) NOT NULL CHECK (amount > 0 AND amount < 'Infinity'::numeric),
  currency text NOT NULL DEFAULT 'INR' CHECK (currency='INR'),
  razorpay_order_id text, razorpay_payment_id text,
  capture_event_id text, captured_at timestamptz,
  request_key uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (gym_id,id), UNIQUE (gym_id,request_key),
  UNIQUE (gym_id,razorpay_order_id), UNIQUE (gym_id,razorpay_payment_id), UNIQUE (gym_id,capture_event_id),
  FOREIGN KEY (gym_id,bill_order_id) REFERENCES public.bill_orders(gym_id,id),
  CHECK (status <> 'captured' OR (captured_at IS NOT NULL AND length(btrim(razorpay_payment_id)) > 0 AND razorpay_payment_id IS NOT NULL AND razorpay_order_id IS NOT NULL))
);
CREATE UNIQUE INDEX bill_payment_one_capture ON public.bill_payments(gym_id,bill_order_id) WHERE status='captured';

ALTER TABLE public.invoices
  ADD COLUMN sold_by uuid,
  ADD COLUMN customer_name text,
  ADD COLUMN bill_payment_id uuid,
  ALTER COLUMN member_id DROP NOT NULL,
  ALTER COLUMN payment_id DROP NOT NULL,
  ADD CONSTRAINT invoices_sold_by_tenant_fk FOREIGN KEY (gym_id,sold_by) REFERENCES public.gym_members(gym_id,id),
  ADD CONSTRAINT invoices_bill_payment_tenant_fk FOREIGN KEY (gym_id,bill_payment_id) REFERENCES public.bill_payments(gym_id,id),
  ADD CONSTRAINT invoices_payment_path_check CHECK (
    (payment_id IS NOT NULL AND bill_payment_id IS NULL AND member_id IS NOT NULL)
    OR (payment_id IS NULL AND bill_payment_id IS NOT NULL AND customer_name IS NOT NULL AND length(btrim(customer_name)) > 0)
  ),
  ADD CONSTRAINT invoices_bill_payment_unique UNIQUE (gym_id,bill_payment_id);
CREATE INDEX invoices_sold_by_month_idx ON public.invoices(gym_id,sold_by,invoice_date);

CREATE TABLE public.bill_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id uuid NOT NULL REFERENCES public.gyms(id) ON DELETE RESTRICT,
  invoice_id uuid NOT NULL,
  item_type text NOT NULL CHECK (item_type IN ('membership_plan','product','service','other_charge')),
  item_id uuid,
  plan_id uuid GENERATED ALWAYS AS (CASE WHEN item_type='membership_plan' THEN item_id END) STORED,
  product_id uuid GENERATED ALWAYS AS (CASE WHEN item_type='product' THEN item_id END) STORED,
  description text NOT NULL CHECK (length(btrim(description)) > 0),
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price numeric(10,2) NOT NULL CHECK (unit_price >= 0 AND unit_price < 'Infinity'::numeric),
  discount_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  taxable_amount numeric(12,2) NOT NULL CHECK (taxable_amount >= 0),
  gst_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (gst_amount >= 0),
  total_amount numeric(12,2) NOT NULL CHECK (total_amount >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (gym_id,invoice_id) REFERENCES public.invoices(gym_id,id),
  FOREIGN KEY (gym_id,plan_id) REFERENCES public.membership_plans(gym_id,id),
  FOREIGN KEY (gym_id,product_id) REFERENCES public.products(gym_id,id),
  CHECK ((item_type IN ('membership_plan','product')) = (item_id IS NOT NULL)),
  CHECK (item_type <> 'membership_plan' OR quantity=1),
  CHECK (taxable_amount = quantity * unit_price - discount_amount),
  CHECK (total_amount = taxable_amount + gst_amount)
);

CREATE TABLE public.follow_ups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id uuid NOT NULL REFERENCES public.gyms(id) ON DELETE RESTRICT,
  follow_up_type text NOT NULL CHECK (follow_up_type IN ('new_lead','renewal','payment_due','manual')),
  related_type text NOT NULL CHECK (related_type IN ('lead','member')),
  related_id uuid NOT NULL,
  related_lead_id uuid GENERATED ALWAYS AS (CASE WHEN related_type='lead' THEN related_id END) STORED,
  related_member_id uuid GENERATED ALWAYS AS (CASE WHEN related_type='member' THEN related_id END) STORED,
  assigned_to uuid, due_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','missed')),
  notes text, completed_at timestamptz, completed_by uuid,
  source_membership_id uuid, source_bill_order_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (gym_id,related_lead_id) REFERENCES public.leads(gym_id,id),
  FOREIGN KEY (gym_id,related_member_id) REFERENCES public.gym_members(gym_id,id),
  FOREIGN KEY (gym_id,assigned_to) REFERENCES public.gym_members(gym_id,id),
  FOREIGN KEY (gym_id,completed_by) REFERENCES public.gym_members(gym_id,id),
  FOREIGN KEY (gym_id,source_membership_id) REFERENCES public.memberships(gym_id,id),
  FOREIGN KEY (gym_id,source_bill_order_id) REFERENCES public.bill_orders(gym_id,id),
  UNIQUE (gym_id,source_membership_id), UNIQUE (gym_id,source_bill_order_id),
  CHECK ((status='completed' AND completed_at IS NOT NULL) OR (status<>'completed' AND completed_at IS NULL AND completed_by IS NULL)),
  CHECK (source_membership_id IS NULL OR (follow_up_type='renewal' AND related_type='member' AND source_bill_order_id IS NULL)),
  CHECK (source_bill_order_id IS NULL OR (follow_up_type='payment_due' AND related_type='member' AND source_membership_id IS NULL))
);

CREATE TABLE public.staff_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id uuid NOT NULL REFERENCES public.gyms(id) ON DELETE RESTRICT,
  staff_member_id uuid NOT NULL, month date NOT NULL CHECK (extract(day FROM month)=1),
  base_salary numeric(10,2) NOT NULL DEFAULT 0 CHECK (base_salary >= 0 AND base_salary < 'Infinity'::numeric),
  commission_rate numeric(5,2) NOT NULL DEFAULT 0 CHECK (commission_rate BETWEEN 0 AND 100),
  total_sales numeric(12,2) NOT NULL DEFAULT 0 CHECK (total_sales >= 0 AND total_sales < 'Infinity'::numeric),
  commission_amount numeric(12,2) NOT NULL DEFAULT 0,
  total_earnings numeric(12,2) NOT NULL DEFAULT 0,
  payout_status text NOT NULL DEFAULT 'pending' CHECK (payout_status IN ('pending','processing','paid')),
  payout_date date, notes text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (gym_id,staff_member_id,month),
  FOREIGN KEY (gym_id,staff_member_id) REFERENCES public.gym_members(gym_id,id),
  CHECK (commission_amount=round(total_sales * commission_rate / 100,2)),
  CHECK (total_earnings=base_salary+commission_amount),
  CHECK ((payout_status='paid') = (payout_date IS NOT NULL))
);

ALTER TABLE public.credit_notes
  ADD COLUMN status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','partially_redeemed','redeemed','void')),
  ADD COLUMN redeemed_amount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN credit_note_date date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Kolkata')::date,
  ADD CONSTRAINT credit_notes_balance_check CHECK (
    redeemed_amount >= 0 AND redeemed_amount <= amount AND amount < 'Infinity'::numeric
    AND ((status IN ('open','void') AND redeemed_amount=0)
      OR (status='partially_redeemed' AND redeemed_amount>0 AND redeemed_amount<amount)
      OR (status='redeemed' AND redeemed_amount=amount))
  );

-- Each FK gets a covering index; all business filtering begins with gym_id.
DO $$
DECLARE t text; c text;
BEGIN
  FOR t,c IN SELECT * FROM (VALUES
    ('leads','assigned_to'),('leads','converted_member_id'),('leads','created_by'),
    ('lead_activities','lead_id'),('lead_activities','created_by'),
    ('staff_attendance','marked_by'),('expenses','created_by'),
    ('bill_orders','member_id'),('bill_orders','sold_by'),('bill_orders','created_by'),
    ('bill_order_items','plan_id'),('bill_order_items','product_id'),
    ('bill_payments','bill_order_id'),('bill_items','invoice_id'),('bill_items','plan_id'),('bill_items','product_id'),
    ('follow_ups','related_lead_id'),('follow_ups','related_member_id'),('follow_ups','assigned_to'),('follow_ups','completed_by')
  ) AS indexes(t,c) LOOP
    EXECUTE format('CREATE INDEX %I ON public.%I (gym_id,%I)',t||'_'||c||'_v2_idx',t,c);
  END LOOP;
END $$;
CREATE INDEX leads_stage_idx ON public.leads(gym_id,stage,created_at DESC);
CREATE INDEX lead_activities_recent_idx ON public.lead_activities(gym_id,lead_id,created_at DESC);
CREATE INDEX follow_ups_due_idx ON public.follow_ups(gym_id,status,due_date);
CREATE INDEX staff_attendance_gym_date_idx ON public.staff_attendance(gym_id,date);
CREATE INDEX expenses_date_category_idx ON public.expenses(gym_id,expense_date,category);
CREATE INDEX products_active_idx ON public.products(gym_id,is_active);
CREATE INDEX bill_orders_due_idx ON public.bill_orders(gym_id,status,due_date);
CREATE INDEX bill_order_items_order_idx ON public.bill_order_items(gym_id,bill_order_id);
CREATE INDEX staff_earnings_month_idx ON public.staff_earnings(gym_id,month);

-- Policy helpers are invoker functions built on the existing authenticated helpers.
CREATE FUNCTION private.v2_staff_access(p_gym_id uuid, p_roles text[], p_write boolean DEFAULT false)
RETURNS boolean LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
 SELECT auth.uid() IS NOT NULL AND (
   private.is_super_admin() OR (
     private.can_read_gym(p_gym_id)
     AND private.get_my_role_in_gym(p_gym_id)=ANY(p_roles)
     AND (NOT p_write OR private.gym_is_active(p_gym_id))
   )
 );
$$;
REVOKE ALL ON FUNCTION private.v2_staff_access(uuid,text[],boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.v2_staff_access(uuid,text[],boolean) TO authenticated,service_role;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['leads','lead_activities','follow_ups','staff_attendance','expenses','products','bill_orders','bill_order_items','bill_payments','bill_items','staff_earnings'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    -- Override permissive installation defaults. Financial writes go through server operations.
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated',t);
    EXECUTE format('GRANT SELECT,INSERT,UPDATE ON public.%I TO service_role',t);
    EXECUTE format('REVOKE DELETE,TRUNCATE ON public.%I FROM service_role',t);
    EXECUTE format('CREATE POLICY v2_no_delete ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (false)',t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['leads','follow_ups','staff_attendance','expenses','products','bill_orders','bill_payments','staff_earnings'] LOOP
    EXECUTE format('CREATE TRIGGER v2_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at()',t);
  END LOOP;
END $$;

CREATE POLICY leads_read ON public.leads FOR SELECT TO authenticated USING (
  private.v2_staff_access(gym_id,ARRAY['owner','admin','receptionist'])
  OR (private.v2_staff_access(gym_id,ARRAY['trainer']) AND private.is_own_member(assigned_to))
);
CREATE POLICY leads_insert ON public.leads FOR INSERT TO authenticated WITH CHECK (private.v2_staff_access(gym_id,ARRAY['owner','admin','receptionist'],true));
CREATE POLICY leads_update ON public.leads FOR UPDATE TO authenticated USING (private.v2_staff_access(gym_id,ARRAY['owner','admin','receptionist'],true)) WITH CHECK (private.v2_staff_access(gym_id,ARRAY['owner','admin','receptionist'],true));
GRANT INSERT (gym_id,name,phone,email,source,convertibility,stage,assigned_to,notes),
  UPDATE (name,phone,email,source,convertibility,stage,assigned_to,notes,is_active) ON public.leads TO authenticated;

CREATE POLICY activities_read ON public.lead_activities FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.leads l WHERE l.gym_id=lead_activities.gym_id AND l.id=lead_activities.lead_id)
);
CREATE POLICY activities_insert ON public.lead_activities FOR INSERT TO authenticated WITH CHECK (
  private.v2_staff_access(gym_id,ARRAY['owner','admin','receptionist','trainer'],true)
  AND EXISTS (SELECT 1 FROM public.leads l WHERE l.gym_id=lead_activities.gym_id AND l.id=lead_activities.lead_id AND l.is_active)
);
CREATE POLICY activities_update ON public.lead_activities FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
GRANT INSERT (gym_id,lead_id,activity_type,notes) ON public.lead_activities TO authenticated;

CREATE POLICY follow_ups_read ON public.follow_ups FOR SELECT TO authenticated USING (
  private.v2_staff_access(gym_id,ARRAY['owner','admin','receptionist'])
  OR (private.v2_staff_access(gym_id,ARRAY['trainer']) AND private.is_own_member(assigned_to))
);
CREATE POLICY follow_ups_insert ON public.follow_ups FOR INSERT TO authenticated WITH CHECK (private.v2_staff_access(gym_id,ARRAY['owner','admin','receptionist'],true));
CREATE POLICY follow_ups_update ON public.follow_ups FOR UPDATE TO authenticated USING (
  private.v2_staff_access(gym_id,ARRAY['owner','admin','receptionist'],true)
  OR (private.v2_staff_access(gym_id,ARRAY['trainer'],true) AND private.is_own_member(assigned_to))
) WITH CHECK (
  private.v2_staff_access(gym_id,ARRAY['owner','admin','receptionist'],true)
  OR (private.v2_staff_access(gym_id,ARRAY['trainer'],true) AND private.is_own_member(assigned_to))
);
GRANT INSERT (gym_id,follow_up_type,related_type,related_id,assigned_to,due_date,notes),
  UPDATE (assigned_to,due_date,status,notes) ON public.follow_ups TO authenticated;

CREATE POLICY staff_attendance_read ON public.staff_attendance FOR SELECT TO authenticated USING (
  private.v2_staff_access(gym_id,ARRAY['owner','admin','receptionist'])
  OR (private.v2_staff_access(gym_id,ARRAY['trainer']) AND private.is_own_member(staff_member_id))
);
CREATE POLICY staff_attendance_insert ON public.staff_attendance FOR INSERT TO authenticated WITH CHECK (private.v2_staff_access(gym_id,ARRAY['owner','admin'],true));
CREATE POLICY staff_attendance_update ON public.staff_attendance FOR UPDATE TO authenticated USING (private.v2_staff_access(gym_id,ARRAY['owner','admin'],true)) WITH CHECK (private.v2_staff_access(gym_id,ARRAY['owner','admin'],true));
GRANT INSERT (gym_id,staff_member_id,date,check_in_at,check_out_at,status,notes), UPDATE (check_in_at,check_out_at,status,notes) ON public.staff_attendance TO authenticated;

CREATE POLICY expenses_read ON public.expenses FOR SELECT TO authenticated USING (private.v2_staff_access(gym_id,ARRAY['owner','admin','receptionist']));
CREATE POLICY expenses_insert ON public.expenses FOR INSERT TO authenticated WITH CHECK (private.v2_staff_access(gym_id,ARRAY['owner','admin','receptionist'],true));
CREATE POLICY expenses_update ON public.expenses FOR UPDATE TO authenticated USING (
  private.v2_staff_access(gym_id,ARRAY['owner','admin'],true)
  OR (private.v2_staff_access(gym_id,ARRAY['receptionist'],true) AND private.is_own_member(created_by))
) WITH CHECK (
  private.v2_staff_access(gym_id,ARRAY['owner','admin'],true)
  OR (private.v2_staff_access(gym_id,ARRAY['receptionist'],true) AND private.is_own_member(created_by))
);
GRANT INSERT (gym_id,category,amount,description,expense_date,receipt_url), UPDATE (category,amount,description,expense_date,receipt_url,is_active) ON public.expenses TO authenticated;

CREATE POLICY products_read ON public.products FOR SELECT TO authenticated USING (private.v2_staff_access(gym_id,ARRAY['owner','admin','receptionist']));
CREATE POLICY products_insert ON public.products FOR INSERT TO authenticated WITH CHECK (private.v2_staff_access(gym_id,ARRAY['owner','admin'],true));
CREATE POLICY products_update ON public.products FOR UPDATE TO authenticated USING (private.v2_staff_access(gym_id,ARRAY['owner','admin'],true)) WITH CHECK (private.v2_staff_access(gym_id,ARRAY['owner','admin'],true));
GRANT INSERT (gym_id,name,description,price,category,stock_quantity), UPDATE (name,description,price,category,stock_quantity,is_active) ON public.products TO authenticated;

CREATE POLICY bill_orders_read ON public.bill_orders FOR SELECT TO authenticated USING (
  private.v2_staff_access(gym_id,ARRAY['owner','admin','receptionist'])
  OR (private.can_read_gym(gym_id) AND private.is_own_member(member_id))
);
CREATE POLICY bill_order_items_read ON public.bill_order_items FOR SELECT TO authenticated USING (EXISTS (
  SELECT 1 FROM public.bill_orders b WHERE b.gym_id=bill_order_items.gym_id AND b.id=bill_order_items.bill_order_id
));
CREATE POLICY bill_payments_read ON public.bill_payments FOR SELECT TO authenticated USING (EXISTS (
  SELECT 1 FROM public.bill_orders b WHERE b.gym_id=bill_payments.gym_id AND b.id=bill_payments.bill_order_id
));
CREATE POLICY bill_items_read ON public.bill_items FOR SELECT TO authenticated USING (EXISTS (
  SELECT 1 FROM public.invoices i WHERE i.gym_id=bill_items.gym_id AND i.id=bill_items.invoice_id
));
CREATE POLICY staff_earnings_read ON public.staff_earnings FOR SELECT TO authenticated USING (
  private.v2_staff_access(gym_id,ARRAY['owner','admin'])
  OR (private.v2_staff_access(gym_id,ARRAY['receptionist','trainer']) AND private.is_own_member(staff_member_id))
);
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['bill_orders','bill_order_items','bill_payments','bill_items','staff_earnings'] LOOP
    EXECUTE format('CREATE POLICY v2_server_insert ON public.%I FOR INSERT TO authenticated WITH CHECK (false)',t);
    EXECUTE format('CREATE POLICY v2_server_update ON public.%I FOR UPDATE TO authenticated USING (false) WITH CHECK (false)',t);
  END LOOP;
END $$;

-- No existing RLS policy is dropped or widened. Existing invoice policies already
-- allow staff to read same-gym invoices even when their member_id is null.

CREATE FUNCTION private.v2_guard_business_write() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE actor uuid; target uuid; parent public.bill_orders%ROWTYPE; payload jsonb := to_jsonb(NEW);
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Archive records instead of deleting them'; END IF;
  IF TG_OP='UPDATE' THEN
    IF NEW.id IS DISTINCT FROM OLD.id OR NEW.gym_id IS DISTINCT FROM OLD.gym_id
      OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Record identity and tenant are immutable';
    END IF;
    IF TG_TABLE_NAME IN ('lead_activities','bill_items') THEN RAISE EXCEPTION 'Issued records are immutable'; END IF;
    IF TG_TABLE_NAME='staff_earnings' AND to_jsonb(OLD)->>'payout_status'='paid' THEN
      RAISE EXCEPTION 'Paid payroll snapshots are immutable';
    END IF;
    IF TG_TABLE_NAME='bill_payments' AND to_jsonb(OLD)->>'status'='captured' THEN
      RAISE EXCEPTION 'Captured bill payments are immutable';
    END IF;
    IF TG_TABLE_NAME='bill_orders' AND to_jsonb(OLD)->>'status' IN ('paid','cancelled') THEN
      RAISE EXCEPTION 'Closed bills are immutable';
    END IF;
    IF TG_TABLE_NAME IN ('leads','expenses') AND payload->>'created_by' IS DISTINCT FROM to_jsonb(OLD)->>'created_by' THEN
      RAISE EXCEPTION 'Creator is immutable';
    END IF;
  END IF;

  IF current_user NOT IN ('postgres','service_role') THEN
    SELECT id INTO actor FROM public.gym_members
    WHERE gym_id=NEW.gym_id AND profile_id=auth.uid() AND is_active;
    IF actor IS NULL AND NOT private.is_super_admin() THEN RAISE EXCEPTION 'Active staff account required'; END IF;
    IF TG_TABLE_NAME IN ('leads','lead_activities','expenses') AND TG_OP='INSERT' THEN
      NEW := jsonb_populate_record(NEW,jsonb_build_object('created_by',actor));
    END IF;
    IF TG_TABLE_NAME='lead_activities' AND payload->>'activity_type' NOT IN ('call','whatsapp_message','visit','note') THEN
      RAISE EXCEPTION 'System activities require a server operation';
    END IF;
    IF TG_TABLE_NAME='staff_attendance' THEN
      NEW := jsonb_populate_record(NEW,jsonb_build_object('marked_by',actor));
    END IF;
    IF TG_TABLE_NAME='follow_ups' AND TG_OP='UPDATE' THEN
      IF payload->>'status'='completed' AND to_jsonb(OLD)->>'status'<>'completed' THEN
        NEW := jsonb_populate_record(NEW,jsonb_build_object('completed_by',actor,'completed_at',now()));
      ELSIF payload->>'status'<>'completed' THEN
        NEW := jsonb_populate_record(NEW,jsonb_build_object('completed_by',NULL,'completed_at',NULL));
      END IF;
    END IF;
  END IF;

  IF TG_TABLE_NAME IN ('leads','follow_ups','staff_attendance','staff_earnings') THEN
    target := CASE WHEN TG_TABLE_NAME IN ('leads','follow_ups') THEN (payload->>'assigned_to')::uuid ELSE (payload->>'staff_member_id')::uuid END;
    IF target IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.gym_members gm WHERE gm.gym_id=NEW.gym_id AND gm.id=target
      AND gm.is_active AND gm.role IN ('owner','admin','receptionist','trainer')
    ) THEN RAISE EXCEPTION 'Choose active staff from this gym'; END IF;
  END IF;
  IF TG_TABLE_NAME='bill_orders' THEN
    IF NOT EXISTS (SELECT 1 FROM public.gym_members gm WHERE gm.gym_id=NEW.gym_id AND gm.id=(payload->>'sold_by')::uuid AND gm.is_active AND gm.role IN ('owner','admin','receptionist')) THEN
      RAISE EXCEPTION 'Sold by must be active sales staff in this gym';
    END IF;
    IF (payload->>'member_id') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.gym_members gm WHERE gm.gym_id=NEW.gym_id AND gm.id=(payload->>'member_id')::uuid AND gm.role='member' AND gm.is_active) THEN
      RAISE EXCEPTION 'Choose an active member in this gym';
    END IF;
  END IF;
  IF TG_TABLE_NAME='bill_order_items' THEN
    SELECT * INTO STRICT parent FROM public.bill_orders WHERE gym_id=NEW.gym_id AND id=(payload->>'bill_order_id')::uuid FOR UPDATE;
    IF parent.status<>'draft' THEN RAISE EXCEPTION 'Only draft bill items can change'; END IF;
    IF payload->>'item_type'='membership_plan' AND parent.member_id IS NULL THEN RAISE EXCEPTION 'Membership purchases require a member'; END IF;
    IF TG_OP='UPDATE' AND payload->>'bill_order_id' IS DISTINCT FROM to_jsonb(OLD)->>'bill_order_id' THEN RAISE EXCEPTION 'Bill item parent is immutable'; END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.v2_guard_business_write() FROM PUBLIC,anon,authenticated;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['leads','lead_activities','follow_ups','staff_attendance','expenses','products','bill_orders','bill_order_items','bill_payments','bill_items','staff_earnings'] LOOP
    EXECUTE format('CREATE TRIGGER v2_guard_write BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION private.v2_guard_business_write()',t);
  END LOOP;
END $$;

-- A V2 invoice can only reference an actually captured payment, with exactly
-- the customer, salesperson, and totals frozen in its associated bill.
CREATE FUNCTION private.v2_check_invoice_payment() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE payment public.bill_payments%ROWTYPE; bill public.bill_orders%ROWTYPE;
BEGIN
  IF NEW.bill_payment_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO STRICT payment FROM public.bill_payments WHERE gym_id=NEW.gym_id AND id=NEW.bill_payment_id FOR UPDATE;
  SELECT * INTO STRICT bill FROM public.bill_orders WHERE gym_id=NEW.gym_id AND id=payment.bill_order_id FOR UPDATE;
  IF payment.status<>'captured' OR payment.amount<>NEW.total_amount OR bill.total_amount<>NEW.total_amount
    OR bill.member_id IS DISTINCT FROM NEW.member_id OR bill.sold_by IS DISTINCT FROM NEW.sold_by
    OR bill.customer_name IS DISTINCT FROM NEW.customer_name OR NEW.member_name IS DISTINCT FROM NEW.customer_name
    OR NEW.payment_method<>'online' OR NEW.payment_ref IS DISTINCT FROM payment.razorpay_payment_id
    OR NEW.subtotal<>bill.subtotal OR NEW.discount_amount<>bill.discount_amount
    OR NEW.taxable_amount<>bill.taxable_amount OR NEW.cgst_amount+NEW.sgst_amount<>bill.gst_amount THEN
    RAISE EXCEPTION 'Invoice must match a captured Razorpay bill payment';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.v2_check_invoice_payment() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER v2_invoice_payment BEFORE INSERT ON public.invoices FOR EACH ROW EXECUTE FUNCTION private.v2_check_invoice_payment();

CREATE FUNCTION private.v2_require_payroll_manager(p_gym_id uuid,p_actor_profile_id uuid)
RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.gyms WHERE id=p_gym_id) THEN RAISE EXCEPTION 'Gym not found'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=p_actor_profile_id AND is_super_admin)
    AND NOT EXISTS (
      SELECT 1 FROM public.gym_members gm JOIN public.gyms g ON g.id=gm.gym_id
      WHERE gm.gym_id=p_gym_id AND gm.profile_id=p_actor_profile_id AND gm.is_active
      AND gm.role IN ('owner','admin') AND g.is_active
    ) THEN RAISE EXCEPTION 'Owner or admin required' USING ERRCODE='42501'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION private.v2_require_payroll_manager(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.v2_require_payroll_manager(uuid,uuid) TO service_role;

-- Called by authenticated Edge Functions with the verified JWT user id. A
-- browser cannot call these with a forged actor because it has no EXECUTE grant.
CREATE FUNCTION public.v2_update_staff_compensation(p_gym_id uuid,p_actor_profile_id uuid,p_staff_member_id uuid,p_base_salary numeric,p_commission_rate numeric)
RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
  PERFORM private.v2_require_payroll_manager(p_gym_id,p_actor_profile_id);
  IF p_base_salary IS NULL OR p_base_salary<0 OR p_base_salary>99999999.99
    OR p_commission_rate IS NULL OR p_commission_rate NOT BETWEEN 0 AND 100 THEN RAISE EXCEPTION 'Invalid compensation'; END IF;
  UPDATE public.gym_members SET base_salary=p_base_salary,commission_rate=p_commission_rate
  WHERE gym_id=p_gym_id AND id=p_staff_member_id AND is_active AND role IN ('owner','admin','receptionist','trainer');
  IF NOT FOUND THEN RAISE EXCEPTION 'Staff member not found'; END IF;
END;
$$;

CREATE FUNCTION public.v2_refresh_staff_earnings(p_gym_id uuid,p_actor_profile_id uuid,p_month date)
RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
  PERFORM private.v2_require_payroll_manager(p_gym_id,p_actor_profile_id);
  IF p_month IS NULL OR extract(day FROM p_month)<>1 THEN RAISE EXCEPTION 'Month must be its first day'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('v2-payroll:'||p_gym_id::text||':'||p_month::text,0));
  INSERT INTO public.staff_earnings(gym_id,staff_member_id,month,base_salary,commission_rate,total_sales,commission_amount,total_earnings)
  SELECT gm.gym_id,gm.id,p_month,gm.base_salary,gm.commission_rate,
    coalesce(s.sales,0),round(coalesce(s.sales,0)*gm.commission_rate/100,2),
    gm.base_salary+round(coalesce(s.sales,0)*gm.commission_rate/100,2)
  FROM public.gym_members gm
  LEFT JOIN LATERAL (
    SELECT sum(i.total_amount) sales FROM public.invoices i
    WHERE i.gym_id=p_gym_id AND i.sold_by=gm.id
      AND i.invoice_date>=p_month AND i.invoice_date<(p_month+interval '1 month')::date
  ) s ON true
  WHERE gm.gym_id=p_gym_id AND gm.is_active AND gm.role IN ('owner','admin','receptionist','trainer')
  ON CONFLICT (gym_id,staff_member_id,month) DO UPDATE
    SET base_salary=EXCLUDED.base_salary,commission_rate=EXCLUDED.commission_rate,
      total_sales=EXCLUDED.total_sales,commission_amount=EXCLUDED.commission_amount,total_earnings=EXCLUDED.total_earnings
    WHERE public.staff_earnings.payout_status<>'paid';
END;
$$;

CREATE FUNCTION public.v2_mark_staff_earnings_paid(p_gym_id uuid,p_actor_profile_id uuid,p_staff_member_id uuid,p_month date)
RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
  PERFORM private.v2_require_payroll_manager(p_gym_id,p_actor_profile_id);
  PERFORM public.v2_refresh_staff_earnings(p_gym_id,p_actor_profile_id,p_month);
  UPDATE public.staff_earnings SET payout_status='paid',payout_date=(now() AT TIME ZONE 'Asia/Kolkata')::date
  WHERE gym_id=p_gym_id AND staff_member_id=p_staff_member_id AND month=p_month AND payout_status<>'paid';
  IF NOT FOUND AND NOT EXISTS (SELECT 1 FROM public.staff_earnings WHERE gym_id=p_gym_id AND staff_member_id=p_staff_member_id AND month=p_month AND payout_status='paid') THEN
    RAISE EXCEPTION 'Staff earnings not found';
  END IF;
END;
$$;

CREATE FUNCTION public.v2_issue_credit_note(p_gym_id uuid,p_actor_profile_id uuid,p_invoice_id uuid,p_amount numeric,p_reason text,p_date date)
RETURNS uuid LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE inv public.invoices%ROWTYPE; actor uuid; credit_id uuid:=gen_random_uuid(); credited numeric;
BEGIN
  PERFORM private.v2_require_payroll_manager(p_gym_id,p_actor_profile_id);
  SELECT * INTO STRICT inv FROM public.invoices WHERE gym_id=p_gym_id AND id=p_invoice_id FOR UPDATE;
  IF p_amount IS NULL OR p_amount<=0 OR p_amount>inv.total_amount OR p_amount='NaN'::numeric
    OR p_reason IS NULL OR length(btrim(p_reason))<2 OR p_date IS NULL THEN RAISE EXCEPTION 'Invalid credit note'; END IF;
  SELECT coalesce(sum(amount),0) INTO credited FROM public.credit_notes WHERE gym_id=p_gym_id AND invoice_id=p_invoice_id AND status<>'void';
  IF credited+p_amount>inv.total_amount THEN RAISE EXCEPTION 'Credit exceeds remaining invoice value'; END IF;
  SELECT id INTO actor FROM public.gym_members WHERE gym_id=p_gym_id AND profile_id=p_actor_profile_id AND is_active;
  INSERT INTO public.credit_notes(id,gym_id,invoice_id,credit_note_number,reason,amount,created_by,credit_note_date)
  VALUES(credit_id,p_gym_id,p_invoice_id,'CN-'||to_char(p_date,'YYYY')||'-'||upper(replace(credit_id::text,'-','')),btrim(p_reason),p_amount,actor,p_date);
  RETURN credit_id;
END;
$$;

CREATE FUNCTION public.v2_redeem_credit_note(p_gym_id uuid,p_actor_profile_id uuid,p_credit_note_id uuid,p_amount numeric)
RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE credit public.credit_notes%ROWTYPE; balance numeric;
BEGIN
  PERFORM private.v2_require_payroll_manager(p_gym_id,p_actor_profile_id);
  SELECT * INTO STRICT credit FROM public.credit_notes WHERE gym_id=p_gym_id AND id=p_credit_note_id FOR UPDATE;
  IF p_amount IS NULL OR p_amount<=0 OR p_amount='NaN'::numeric OR credit.status NOT IN ('open','partially_redeemed') THEN RAISE EXCEPTION 'Invalid credit redemption'; END IF;
  balance:=credit.redeemed_amount+p_amount;
  IF balance>credit.amount THEN RAISE EXCEPTION 'Credit balance exceeded'; END IF;
  UPDATE public.credit_notes SET redeemed_amount=balance,status=CASE WHEN balance=amount THEN 'redeemed' ELSE 'partially_redeemed' END
  WHERE gym_id=p_gym_id AND id=p_credit_note_id;
END;
$$;

CREATE FUNCTION public.generate_auto_follow_ups()
RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE today date:=(now() AT TIME ZONE 'Asia/Kolkata')::date; gym record;
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtextextended('fitstack-v2-follow-ups',0)) THEN RETURN; END IF;
  FOR gym IN SELECT id FROM public.gyms WHERE is_active LOOP
    UPDATE public.follow_ups SET status='missed',updated_at=now()
    WHERE gym_id=gym.id AND status='pending' AND due_date<today;
    INSERT INTO public.follow_ups(gym_id,follow_up_type,related_type,related_id,due_date,source_membership_id)
    SELECT m.gym_id,'renewal','member',m.member_id,today,m.id FROM public.memberships m
    JOIN public.gym_members gm ON gm.gym_id=m.gym_id AND gm.id=m.member_id AND gm.is_active
    WHERE m.gym_id=gym.id AND m.status='active' AND m.end_date=today+15
      AND NOT EXISTS (SELECT 1 FROM public.follow_ups f WHERE f.gym_id=gym.id AND f.related_type='member' AND f.related_id=m.member_id AND f.follow_up_type='renewal' AND f.status='pending')
    ON CONFLICT (gym_id,source_membership_id) DO NOTHING;
    -- Walk-ins have no member identity; they are visible in the pending bill queue.
    INSERT INTO public.follow_ups(gym_id,follow_up_type,related_type,related_id,due_date,source_bill_order_id,assigned_to)
    SELECT b.gym_id,'payment_due','member',b.member_id,today,b.id,
      CASE WHEN gm.is_active AND gm.role IN ('owner','admin','receptionist','trainer') THEN b.sold_by ELSE NULL END
    FROM public.bill_orders b JOIN public.gym_members gm ON gm.gym_id=b.gym_id AND gm.id=b.sold_by
    WHERE b.gym_id=gym.id AND b.status='pending' AND b.member_id IS NOT NULL AND b.due_date=today+7
    ON CONFLICT (gym_id,source_bill_order_id) DO NOTHING;
  END LOOP;
END;
$$;

-- Internal, invoker-only operations: the Edge Function verifies JWT identity;
-- database operations validate the actor's tenant and role again.
REVOKE ALL ON FUNCTION public.v2_update_staff_compensation(uuid,uuid,uuid,numeric,numeric),
  public.v2_refresh_staff_earnings(uuid,uuid,date),public.v2_mark_staff_earnings_paid(uuid,uuid,uuid,date),
  public.v2_issue_credit_note(uuid,uuid,uuid,numeric,text,date),public.v2_redeem_credit_note(uuid,uuid,uuid,numeric),
  public.generate_auto_follow_ups() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.v2_update_staff_compensation(uuid,uuid,uuid,numeric,numeric),
  public.v2_refresh_staff_earnings(uuid,uuid,date),public.v2_mark_staff_earnings_paid(uuid,uuid,uuid,date),
  public.v2_issue_credit_note(uuid,uuid,uuid,numeric,text,date),public.v2_redeem_credit_note(uuid,uuid,uuid,numeric),
  public.generate_auto_follow_ups() TO service_role;

COMMENT ON COLUMN public.invoices.customer_name IS 'V2 walk-in/customer snapshot; V1 keeps its existing member_name snapshot.';
COMMENT ON COLUMN public.staff_earnings.total_sales IS 'Sum of invoices.total_amount attributed to this staff member for the invoice month.';
COMMENT ON TABLE public.bill_orders IS 'Unpaid/draft staff bills. Only verified Razorpay capture can issue a V2 invoice.';
NOTIFY pgrst,'reload schema';
COMMIT;
