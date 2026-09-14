BEGIN;
SET LOCAL search_path = public, extensions, pg_catalog;

-- SECURITY DEFINER report functions must enforce tenant and role access internally.
CREATE OR REPLACE FUNCTION public.report_revenue_by_day(p_gym_id uuid, p_from date, p_to date)
RETURNS TABLE(report_date date, transactions bigint, gross_revenue numeric, discounts numeric, taxable numeric, cgst numeric, sgst numeric, net_revenue numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
  IF p_from IS NULL OR p_to IS NULL OR p_from > p_to THEN RAISE EXCEPTION 'Invalid report range'; END IF;
  IF NOT private.can_manage_gym(p_gym_id) THEN RAISE EXCEPTION 'Reports require owner or admin role' USING ERRCODE='42501'; END IF;
  RETURN QUERY SELECT (p.created_at AT TIME ZONE 'Asia/Kolkata')::date,count(*),coalesce(sum(p.amount),0),coalesce(sum(p.discount_amount),0),coalesce(sum(p.taxable_amount),0),coalesce(sum(p.cgst_amount),0),coalesce(sum(p.sgst_amount),0),coalesce(sum(p.total_amount),0) FROM public.payments p WHERE p.gym_id=p_gym_id AND p.status='captured' AND (p.created_at AT TIME ZONE 'Asia/Kolkata')::date BETWEEN p_from AND p_to GROUP BY 1 ORDER BY 1 DESC;
END $$;

CREATE OR REPLACE FUNCTION public.set_gym_active(p_gym_id uuid, p_active boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN IF NOT private.is_super_admin() THEN RAISE EXCEPTION 'Only platform administrators can change gym status' USING ERRCODE='42501'; END IF; UPDATE public.gyms SET is_active=p_active, updated_at=now() WHERE id=p_gym_id; END $$;

CREATE OR REPLACE FUNCTION public.validate_promo_code(p_gym_id uuid, p_code text, p_plan_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE v_promo record;
BEGIN
  SELECT * INTO v_promo FROM public.promo_codes WHERE gym_id=p_gym_id AND upper(code)=upper(trim(p_code)) AND is_active=true;
  IF NOT FOUND THEN RETURN jsonb_build_object('valid',false,'error','Invalid promo code'); END IF;
  IF v_promo.valid_from > now() THEN RETURN jsonb_build_object('valid',false,'error','This promo is not active yet'); END IF;
  IF v_promo.valid_until IS NOT NULL AND v_promo.valid_until < now() THEN RETURN jsonb_build_object('valid',false,'error','This promo has expired'); END IF;
  IF v_promo.max_uses IS NOT NULL AND v_promo.used_count >= v_promo.max_uses THEN RETURN jsonb_build_object('valid',false,'error','This promo has been fully redeemed'); END IF;
  IF v_promo.applicable_plan_ids IS NOT NULL AND NOT (v_promo.applicable_plan_ids ? p_plan_id::text) THEN RETURN jsonb_build_object('valid',false,'error','This promo is not valid for the selected plan'); END IF;
  RETURN jsonb_build_object('valid',true,'promo_code_id',v_promo.id,'discount_type',v_promo.discount_type,'discount_value',v_promo.discount_value,'max_discount_amount',v_promo.max_discount_amount);
END $$;

GRANT EXECUTE ON FUNCTION public.validate_promo_code(uuid,text,uuid) TO authenticated;
COMMIT;
