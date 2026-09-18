-- Run as postgres. All fixtures and side effects are rolled back; no external payments.
BEGIN;
DO $$
DECLARE
  g uuid := gen_random_uuid(); staff uuid := gen_random_uuid(); actor uuid;
  b uuid := gen_random_uuid(); p uuid := gen_random_uuid(); inv uuid := gen_random_uuid();
  credit uuid; month_start date := date_trunc('month',now() AT TIME ZONE 'Asia/Kolkata')::date;
  denied boolean := false; before_count bigint;
BEGIN
  SELECT id INTO STRICT actor FROM public.profiles ORDER BY created_at LIMIT 1;
  INSERT INTO public.gyms(id,name,slug) VALUES(g,'Phase0 rollback verification','phase0-smoke-'||g);
  INSERT INTO public.gym_members(id,gym_id,profile_id,role) VALUES(staff,g,actor,'owner');
  PERFORM set_config('request.jwt.claim.sub',actor::text,true);
  SET LOCAL ROLE authenticated;
  INSERT INTO public.leads(gym_id,name,source) VALUES(g,'Rollback lead','walk_in');
  IF NOT EXISTS(SELECT 1 FROM public.leads WHERE gym_id=g AND created_by=staff) THEN
    RAISE EXCEPTION 'Lead attribution failed';
  END IF;
  BEGIN
    PERFORM base_salary FROM public.gym_members WHERE id=staff;
  EXCEPTION WHEN insufficient_privilege THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Payroll column exposed'; END IF;
  RESET ROLE;
  PERFORM set_config('request.jwt.claim.sub','',true);
  SET LOCAL ROLE service_role;
  INSERT INTO public.bill_orders(id,gym_id,customer_name,sold_by,created_by,subtotal,taxable_amount,gst_amount,total_amount)
    VALUES(b,g,'Rollback walk-in',staff,staff,100,100,5,105);
  INSERT INTO public.bill_payments(id,gym_id,bill_order_id,status,amount,razorpay_order_id,razorpay_payment_id,captured_at)
    VALUES(p,g,b,'captured',105,'smoke_order_'||p,'smoke_pay_'||p,now());
  INSERT INTO public.invoices(id,gym_id,bill_payment_id,invoice_number,gym_name,member_name,customer_name,items,subtotal,taxable_amount,cgst_amount,sgst_amount,total_amount,sold_by,payment_ref)
    VALUES(inv,g,p,'SMOKE-'||inv,'Rollback gym','Rollback walk-in','Rollback walk-in','[]',100,100,2.5,2.5,105,staff,'smoke_pay_'||p);
  PERFORM public.v2_update_staff_compensation(g,actor,staff,1000,5);
  PERFORM public.v2_mark_staff_earnings_paid(g,actor,staff,month_start);
  PERFORM public.v2_update_staff_compensation(g,actor,staff,2000,10);
  PERFORM public.v2_refresh_staff_earnings(g,actor,month_start);
  IF NOT EXISTS(SELECT 1 FROM public.staff_earnings WHERE gym_id=g AND staff_member_id=staff AND total_sales=105 AND total_earnings=1005.25 AND payout_status='paid') THEN
    RAISE EXCEPTION 'Invoice revenue / paid snapshot check failed';
  END IF;
  credit := public.v2_issue_credit_note(g,actor,inv,60,'Rollback credit',CURRENT_DATE);
  PERFORM public.v2_redeem_credit_note(g,actor,credit,60);
  IF NOT EXISTS(SELECT 1 FROM public.credit_notes WHERE id=credit AND status='redeemed') THEN RAISE EXCEPTION 'Credit failed'; END IF;
  denied:=false;
  BEGIN
    UPDATE public.invoices SET customer_name='Forbidden' WHERE id=inv;
  EXCEPTION WHEN raise_exception THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Invoice immutability failed'; END IF;
  PERFORM public.generate_auto_follow_ups();
  SELECT count(*) INTO before_count FROM public.follow_ups;
  PERFORM public.generate_auto_follow_ups();
  IF (SELECT count(*) FROM public.follow_ups)<>before_count THEN RAISE EXCEPTION 'Reminder duplication'; END IF;
  RESET ROLE;
END $$;
ROLLBACK;
SELECT 'passed: live role grants, lead attribution, walk-in invoice, payroll freeze, credit, immutability, reminder idempotence; rolled back' AS verification;
