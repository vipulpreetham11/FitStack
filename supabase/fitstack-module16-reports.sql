-- FitStack Module 16: additive, tenant-safe reporting RPCs.
BEGIN;
SET LOCAL search_path = public, extensions, pg_catalog;

CREATE OR REPLACE FUNCTION public.report_revenue_by_day(p_gym_id uuid, p_from date, p_to date)
RETURNS TABLE(report_date date, transactions bigint, gross_revenue numeric, discounts numeric, taxable numeric, cgst numeric, sgst numeric, net_revenue numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
  IF p_from IS NULL OR p_to IS NULL OR p_from > p_to THEN RAISE EXCEPTION 'Invalid report range'; END IF;
  IF NOT private.can_manage_gym(p_gym_id) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  RETURN QUERY SELECT (p.created_at AT TIME ZONE 'Asia/Kolkata')::date, count(*), coalesce(sum(p.amount),0), coalesce(sum(p.discount_amount),0), coalesce(sum(p.taxable_amount),0), coalesce(sum(p.cgst_amount),0), coalesce(sum(p.sgst_amount),0), coalesce(sum(p.total_amount),0)
  FROM public.payments p WHERE p.gym_id=p_gym_id AND p.status='captured' AND (p.created_at AT TIME ZONE 'Asia/Kolkata')::date BETWEEN p_from AND p_to GROUP BY 1 ORDER BY 1 DESC;
END $$;

CREATE OR REPLACE FUNCTION public.report_attendance_by_day(p_gym_id uuid, p_from date, p_to date)
RETURNS TABLE(report_date date, total_checkins bigint, unique_members bigint, peak_hour integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
  IF p_from IS NULL OR p_to IS NULL OR p_from > p_to THEN RAISE EXCEPTION 'Invalid report range'; END IF;
  IF NOT private.can_manage_gym(p_gym_id) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  RETURN QUERY WITH base AS (SELECT (a.check_in_at AT TIME ZONE 'Asia/Kolkata')::date d, extract(hour FROM a.check_in_at AT TIME ZONE 'Asia/Kolkata')::integer h, a.member_id FROM public.attendance a WHERE a.gym_id=p_gym_id AND (a.check_in_at AT TIME ZONE 'Asia/Kolkata')::date BETWEEN p_from AND p_to), daily AS (SELECT d,count(*) total,count(DISTINCT member_id) unique_count FROM base GROUP BY d), hours AS (SELECT d,h,count(*) c,row_number() OVER(PARTITION BY d ORDER BY count(*) DESC,h) n FROM base GROUP BY d,h)
  SELECT d.d,d.total,d.unique_count,h.h FROM daily d LEFT JOIN hours h ON h.d=d.d AND h.n=1 ORDER BY d.d DESC;
END $$;

CREATE OR REPLACE FUNCTION public.report_attendance_by_hour(p_gym_id uuid, p_from date, p_to date)
RETURNS TABLE(report_hour integer, total_checkins bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
  IF p_from IS NULL OR p_to IS NULL OR p_from > p_to THEN RAISE EXCEPTION 'Invalid report range'; END IF;
  IF NOT private.can_manage_gym(p_gym_id) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  RETURN QUERY SELECT extract(hour FROM a.check_in_at AT TIME ZONE 'Asia/Kolkata')::integer,count(*) FROM public.attendance a WHERE a.gym_id=p_gym_id AND (a.check_in_at AT TIME ZONE 'Asia/Kolkata')::date BETWEEN p_from AND p_to GROUP BY 1 ORDER BY 1;
END $$;

CREATE OR REPLACE FUNCTION public.report_membership_status_by_month(p_gym_id uuid)
RETURNS TABLE(month_start date, active bigint, scheduled bigint, frozen bigint, expired bigint, cancelled bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
  IF NOT private.can_manage_gym(p_gym_id) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  RETURN QUERY WITH months AS (SELECT generate_series(date_trunc('month', current_date)-interval '5 months',date_trunc('month',current_date),interval '1 month')::date m)
  SELECT mo.m,count(*) FILTER(WHERE ms.status='active'),count(*) FILTER(WHERE ms.status='scheduled'),count(*) FILTER(WHERE ms.status='frozen'),count(*) FILTER(WHERE ms.status='expired'),count(*) FILTER(WHERE ms.status='cancelled') FROM months mo LEFT JOIN public.memberships ms ON ms.gym_id=p_gym_id AND date_trunc('month',ms.start_date)::date=mo.m GROUP BY mo.m ORDER BY mo.m;
END $$;

REVOKE ALL ON FUNCTION public.report_revenue_by_day(uuid,date,date), public.report_attendance_by_day(uuid,date,date), public.report_attendance_by_hour(uuid,date,date), public.report_membership_status_by_month(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_revenue_by_day(uuid,date,date), public.report_attendance_by_day(uuid,date,date), public.report_attendance_by_hour(uuid,date,date), public.report_membership_status_by_month(uuid) TO authenticated, service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
