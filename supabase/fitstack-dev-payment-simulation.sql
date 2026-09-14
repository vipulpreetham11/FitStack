-- Apply this patch to an existing FitStack database to support frontend
-- development checkout without a locally deployed Edge Function.
BEGIN;

CREATE OR REPLACE FUNCTION public.simulate_payment_checkout(
 p_gym_id uuid,p_member_id uuid,p_plan_id uuid,p_start_date date,
 p_promo_code text DEFAULT NULL,p_preview boolean DEFAULT false
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
 g public.gyms%ROWTYPE; actor public.gym_members%ROWTYPE; member public.gym_members%ROWTYPE;
 plan public.membership_plans%ROWTYPE; promo public.promo_codes%ROWTYPE;
 current_membership public.memberships%ROWTYPE; payment_id uuid; capture jsonb;
 amount numeric(10,2); discount numeric(10,2) := 0; raw_discount numeric;
 taxable numeric(10,2); rate numeric(4,2); half_tax numeric(10,2); total numeric(10,2);
 total_paise bigint; order_id text; razorpay_payment_id text; event_id text; payload jsonb;
 normalized_code text := upper(trim(coalesce(p_promo_code,'')));
 today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
 configured boolean;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE='42501'; END IF;
 IF p_start_date IS NULL OR p_start_date<today THEN RAISE EXCEPTION 'Start date cannot be in the past'; END IF;
 SELECT * INTO g FROM public.gyms WHERE id=p_gym_id;
 IF NOT FOUND OR NOT g.is_active THEN RAISE EXCEPTION 'Gym is inactive' USING ERRCODE='42501'; END IF;
 SELECT * INTO actor FROM public.gym_members WHERE gym_id=p_gym_id AND profile_id=auth.uid() AND is_active=true;
 IF NOT FOUND THEN RAISE EXCEPTION 'You do not have access to this gym' USING ERRCODE='42501'; END IF;
 SELECT * INTO member FROM public.gym_members WHERE id=p_member_id AND gym_id=p_gym_id AND is_active=true;
 IF NOT FOUND THEN RAISE EXCEPTION 'Member was not found'; END IF;
 IF actor.role NOT IN ('owner','admin','receptionist') AND actor.id<>member.id THEN RAISE EXCEPTION 'You can only purchase a membership for yourself' USING ERRCODE='42501'; END IF;
 SELECT * INTO plan FROM public.membership_plans WHERE id=p_plan_id AND gym_id=p_gym_id AND is_active=true;
 IF NOT FOUND THEN RAISE EXCEPTION 'Choose an active membership plan'; END IF;
 IF NOT plan.allow_future_start AND p_start_date<>today THEN RAISE EXCEPTION 'This plan must start today'; END IF;
 IF EXISTS(SELECT 1 FROM public.memberships WHERE gym_id=p_gym_id AND member_id=p_member_id AND status='scheduled') THEN RAISE EXCEPTION 'Member already has a scheduled renewal. Cancel it first to create a new one.'; END IF;
 SELECT * INTO current_membership FROM public.memberships WHERE gym_id=p_gym_id AND member_id=p_member_id AND status IN ('active','frozen') LIMIT 1;
 IF current_membership.id IS NOT NULL AND p_start_date<=current_membership.end_date THEN RAISE EXCEPTION 'Member already has an active membership. Choose a future start date for renewal.'; END IF;
 amount:=round(plan.price,2);
 IF normalized_code<>'' THEN
  SELECT * INTO promo FROM public.promo_codes WHERE gym_id=p_gym_id AND upper(code)=normalized_code AND is_active=true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid promo code'; END IF;
  IF promo.valid_from>now() THEN RAISE EXCEPTION 'This promo is not active yet'; END IF;
  IF promo.valid_until IS NOT NULL AND promo.valid_until<now() THEN RAISE EXCEPTION 'This promo has expired'; END IF;
  IF promo.max_uses IS NOT NULL AND promo.used_count>=promo.max_uses THEN RAISE EXCEPTION 'This promo has been fully redeemed'; END IF;
  IF promo.applicable_plan_ids IS NOT NULL AND NOT (promo.applicable_plan_ids @> jsonb_build_array(plan.id::text)) THEN RAISE EXCEPTION 'This promo is not valid for the selected plan'; END IF;
  raw_discount:=CASE WHEN promo.discount_type='percentage' THEN amount*promo.discount_value/100 ELSE promo.discount_value END;
  IF promo.max_discount_amount IS NOT NULL THEN raw_discount:=least(raw_discount,promo.max_discount_amount); END IF;
  discount:=round(least(amount,raw_discount),2);
 END IF;
 taxable:=round(amount-discount,2);
 rate:=CASE WHEN nullif(trim(g.gstin),'') IS NULL THEN 0 ELSE 5 END;
 half_tax:=round(taxable*rate/200,2);
 total:=round(taxable+half_tax+half_tax,2);
 total_paise:=round(total*100);
 configured:=nullif(trim(g.razorpay_key_id_enc),'') IS NOT NULL AND nullif(trim(g.razorpay_key_secret_enc),'') IS NOT NULL AND nullif(trim(g.razorpay_webhook_secret_enc),'') IS NOT NULL;
 IF p_preview THEN
  RETURN jsonb_build_object('amount',amount,'discountAmount',discount,'taxableAmount',taxable,'gstRate',rate,'cgstAmount',half_tax,'sgstAmount',half_tax,'totalAmount',total,'totalPaise',total_paise,'promoCodeId',promo.id,'promoCode',nullif(normalized_code,''),'orderId',NULL,'paymentId',NULL,'razorpayKeyId',NULL,'currency','INR','simulated',true,'captured',false);
 END IF;
 IF configured THEN RAISE EXCEPTION 'Development payment simulation is disabled because Razorpay is configured'; END IF;
 order_id:='dev_order_'||replace(gen_random_uuid()::text,'-','');
 razorpay_payment_id:=CASE WHEN total_paise>0 THEN 'dev_payment_'||replace(gen_random_uuid()::text,'-','') ELSE NULL END;
 event_id:=CASE WHEN total_paise>0 THEN 'dev_event_'||replace(gen_random_uuid()::text,'-','') ELSE NULL END;
 payload:=CASE WHEN total_paise>0 THEN jsonb_build_object('event','payment.captured','payload',jsonb_build_object('payment',jsonb_build_object('entity',jsonb_build_object('id',razorpay_payment_id,'order_id',order_id,'amount',total_paise,'currency','INR')))) ELSE NULL END;
 INSERT INTO public.payments(gym_id,member_id,plan_id,requested_start_date,amount,discount_amount,taxable_amount,gst_rate,cgst_amount,sgst_amount,total_amount,currency,razorpay_order_id,status,promo_code_id,description,created_by,metadata)
 VALUES(p_gym_id,p_member_id,p_plan_id,p_start_date,amount,discount,taxable,rate,half_tax,half_tax,total,'INR',CASE WHEN total_paise>0 THEN order_id ELSE NULL END,'created',promo.id,plan.name,actor.id,jsonb_build_object('purchase_mode',CASE WHEN current_membership.id IS NULL THEN 'new' ELSE 'renewal' END,'duration_type',plan.duration_type,'duration_value',plan.duration_value,'max_freezes',plan.max_freezes,'max_freeze_days',plan.max_freeze_days,'simulated',true)) RETURNING id INTO payment_id;
 SELECT public.process_payment_capture(payment_id,razorpay_payment_id,CASE WHEN total_paise>0 THEN 'dev_signature' ELSE NULL END,p_plan_id,p_start_date,event_id,payload) INTO capture;
 RETURN jsonb_build_object('amount',amount,'discountAmount',discount,'taxableAmount',taxable,'gstRate',rate,'cgstAmount',half_tax,'sgstAmount',half_tax,'totalAmount',total,'totalPaise',total_paise,'promoCodeId',promo.id,'promoCode',nullif(normalized_code,''),'orderId',CASE WHEN total_paise>0 THEN order_id ELSE NULL END,'paymentId',payment_id,'razorpayKeyId',NULL,'currency','INR','simulated',true,'captured',true,'invoiceId',capture->>'invoice_id','membershipId',capture->>'membership_id');
END; $$;

REVOKE ALL ON FUNCTION public.simulate_payment_checkout(uuid,uuid,uuid,date,text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.simulate_payment_checkout(uuid,uuid,uuid,date,text,boolean) TO authenticated,service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
