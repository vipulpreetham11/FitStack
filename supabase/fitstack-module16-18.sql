-- FitStack Modules 16–18: additive reporting, super-admin RPCs, schedules, and indexes.
-- Safe to run after fitstack-v1.sql. Store fitstack_project_url and fitstack_backup_cron_secret in Vault before enabling the backup schedule.
BEGIN;
SET LOCAL search_path = public, extensions, pg_catalog;

CREATE OR REPLACE FUNCTION public.report_revenue_by_day(p_gym_id uuid, p_from date, p_to date)
RETURNS TABLE(report_date date, transactions bigint, gross_revenue numeric, discounts numeric, taxable numeric, cgst numeric, sgst numeric, net_revenue numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$ BEGIN IF p_from IS NULL OR p_to IS NULL OR p_from>p_to THEN RAISE EXCEPTION 'Invalid report range'; END IF; IF NOT private.can_manage_gym(p_gym_id) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF; RETURN QUERY SELECT (p.created_at AT TIME ZONE 'Asia/Kolkata')::date,count(*),coalesce(sum(p.amount),0),coalesce(sum(p.discount_amount),0),coalesce(sum(p.taxable_amount),0),coalesce(sum(p.cgst_amount),0),coalesce(sum(p.sgst_amount),0),coalesce(sum(p.total_amount),0) FROM public.payments p WHERE p.gym_id=p_gym_id AND p.status='captured' AND (p.created_at AT TIME ZONE 'Asia/Kolkata')::date BETWEEN p_from AND p_to GROUP BY 1 ORDER BY 1 DESC; END $$;
CREATE OR REPLACE FUNCTION public.report_attendance_by_day(p_gym_id uuid,p_from date,p_to date) RETURNS TABLE(report_date date,total_checkins bigint,unique_members bigint,peak_hour integer) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$ BEGIN IF p_from IS NULL OR p_to IS NULL OR p_from>p_to THEN RAISE EXCEPTION 'Invalid report range'; END IF; IF NOT private.can_manage_gym(p_gym_id) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF; RETURN QUERY WITH base AS (SELECT (a.check_in_at AT TIME ZONE 'Asia/Kolkata')::date d,extract(hour FROM a.check_in_at AT TIME ZONE 'Asia/Kolkata')::integer h,a.member_id FROM public.attendance a WHERE a.gym_id=p_gym_id AND (a.check_in_at AT TIME ZONE 'Asia/Kolkata')::date BETWEEN p_from AND p_to),daily AS (SELECT d,count(*) total,count(DISTINCT member_id) unique_count FROM base GROUP BY d),hours AS (SELECT d,h,count(*) c,row_number() OVER(PARTITION BY d ORDER BY count(*) DESC,h) n FROM base GROUP BY d,h) SELECT d.d,d.total,d.unique_count,h.h FROM daily d LEFT JOIN hours h ON h.d=d.d AND h.n=1 ORDER BY d.d DESC; END $$;
CREATE OR REPLACE FUNCTION public.report_attendance_by_hour(p_gym_id uuid,p_from date,p_to date) RETURNS TABLE(report_hour integer,total_checkins bigint) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$ BEGIN IF p_from IS NULL OR p_to IS NULL OR p_from>p_to THEN RAISE EXCEPTION 'Invalid report range'; END IF; IF NOT private.can_manage_gym(p_gym_id) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF; RETURN QUERY SELECT extract(hour FROM a.check_in_at AT TIME ZONE 'Asia/Kolkata')::integer,count(*) FROM public.attendance a WHERE a.gym_id=p_gym_id AND (a.check_in_at AT TIME ZONE 'Asia/Kolkata')::date BETWEEN p_from AND p_to GROUP BY 1 ORDER BY 1; END $$;
CREATE OR REPLACE FUNCTION public.report_membership_status_by_month(p_gym_id uuid) RETURNS TABLE(month_start date,active bigint,scheduled bigint,frozen bigint,expired bigint,cancelled bigint) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$ BEGIN IF NOT private.can_manage_gym(p_gym_id) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF; RETURN QUERY WITH months AS (SELECT generate_series(date_trunc('month',current_date)-interval '5 months',date_trunc('month',current_date),interval '1 month')::date m) SELECT mo.m,count(*) FILTER(WHERE ms.status='active'),count(*) FILTER(WHERE ms.status='scheduled'),count(*) FILTER(WHERE ms.status='frozen'),count(*) FILTER(WHERE ms.status='expired'),count(*) FILTER(WHERE ms.status='cancelled') FROM months mo LEFT JOIN public.memberships ms ON ms.gym_id=p_gym_id AND date_trunc('month',ms.start_date)::date=mo.m GROUP BY mo.m ORDER BY mo.m; END $$;

CREATE OR REPLACE FUNCTION public.get_super_admin_gyms()
RETURNS TABLE(id uuid,name text,slug text,city text,is_active boolean,members_count bigint,active_memberships bigint,revenue_this_month numeric,created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
  IF NOT private.is_super_admin() THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  RETURN QUERY SELECT g.id,g.name,g.slug,g.city,g.is_active,(SELECT count(*) FROM public.gym_members gm WHERE gm.gym_id=g.id),(SELECT count(*) FROM public.memberships m WHERE m.gym_id=g.id AND m.status='active'),(SELECT coalesce(sum(p.total_amount),0) FROM public.payments p WHERE p.gym_id=g.id AND p.status='captured' AND (p.created_at AT TIME ZONE 'Asia/Kolkata')::date>=date_trunc('month',now() AT TIME ZONE 'Asia/Kolkata')::date),g.created_at FROM public.gyms g ORDER BY g.created_at DESC;
END $$;

CREATE OR REPLACE FUNCTION public.get_super_admin_gym_detail(p_gym_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE result jsonb;
BEGIN
  IF NOT private.is_super_admin() THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.gyms WHERE id=p_gym_id) THEN RAISE EXCEPTION 'Gym not found'; END IF;
  SELECT jsonb_build_object(
    'gym',(SELECT to_jsonb(x) FROM (SELECT g.id,g.name,g.slug,g.logo_url,g.brand_color,g.address,g.city,g.state,g.pincode,g.phone,g.email,g.website,g.gstin,g.is_active,(coalesce(g.razorpay_key_id_enc,'')<>'' AND coalesce(g.razorpay_key_secret_enc,'')<>'' AND coalesce(g.razorpay_webhook_secret_enc,'')<>'') razorpay_configured,g.created_at FROM public.gyms g WHERE g.id=p_gym_id) x),
    'members',coalesce((SELECT jsonb_agg(jsonb_build_object('id',gm.id,'member_code',gm.member_code,'role',gm.role,'is_active',gm.is_active,'joined_at',gm.joined_at,'full_name',p.full_name,'phone',p.phone,'email',p.email) ORDER BY p.full_name) FROM public.gym_members gm JOIN public.profiles p ON p.id=gm.profile_id WHERE gm.gym_id=p_gym_id),'[]'::jsonb),
    'financials',jsonb_build_object('revenue_this_month',(SELECT coalesce(sum(total_amount),0) FROM public.payments WHERE gym_id=p_gym_id AND status='captured' AND (created_at AT TIME ZONE 'Asia/Kolkata')::date>=date_trunc('month',now() AT TIME ZONE 'Asia/Kolkata')::date),'captured_payments',(SELECT count(*) FROM public.payments WHERE gym_id=p_gym_id AND status='captured'),'failed_payments',(SELECT count(*) FROM public.payments WHERE gym_id=p_gym_id AND status='failed'),'pending_payments',(SELECT count(*) FROM public.payments WHERE gym_id=p_gym_id AND status='created')),
    'recent_payments',coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC) FROM (SELECT pay.id,pay.created_at,pay.description,pay.total_amount,pay.status,pro.full_name member_name FROM public.payments pay JOIN public.gym_members gm ON gm.id=pay.member_id JOIN public.profiles pro ON pro.id=gm.profile_id WHERE pay.gym_id=p_gym_id ORDER BY pay.created_at DESC LIMIT 20) x),'[]'::jsonb)
  ) INTO result;
  RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.set_gym_active(p_gym_id uuid,p_active boolean) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ BEGIN IF NOT private.is_super_admin() THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF; UPDATE public.gyms SET is_active=p_active,updated_at=now() WHERE id=p_gym_id; IF NOT FOUND THEN RAISE EXCEPTION 'Gym not found'; END IF; RETURN p_active; END $$;

REVOKE ALL ON FUNCTION public.report_revenue_by_day(uuid,date,date),public.report_attendance_by_day(uuid,date,date),public.report_attendance_by_hour(uuid,date,date),public.report_membership_status_by_month(uuid),public.get_super_admin_gyms(),public.get_super_admin_gym_detail(uuid),public.set_gym_active(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.report_revenue_by_day(uuid,date,date),public.report_attendance_by_day(uuid,date,date),public.report_attendance_by_hour(uuid,date,date),public.report_membership_status_by_month(uuid),public.get_super_admin_gyms(),public.get_super_admin_gym_detail(uuid),public.set_gym_active(uuid,boolean) TO authenticated,service_role;

CREATE INDEX IF NOT EXISTS idx_reports_payments_gym_status_created ON public.payments(gym_id,status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_memberships_gym_created ON public.memberships(gym_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_memberships_gym_start ON public.memberships(gym_id,start_date DESC);
CREATE INDEX IF NOT EXISTS idx_reports_scan_events_created ON public.scan_events(gym_id,created_at DESC);
NOTIFY pgrst, 'reload schema';
COMMIT;

-- Scheduling is intentionally outside the transaction because cron.schedule commits its own job metadata.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
DO $$ DECLARE job record; BEGIN FOR job IN SELECT jobid FROM cron.job WHERE jobname IN ('fitstack-weekly-backup','fitstack-attendance-cleanup','fitstack-invoice-reset') LOOP PERFORM cron.unschedule(job.jobid); END LOOP; END $$;
SELECT cron.schedule('fitstack-weekly-backup','30 20 * * 0',$schedule$SELECT net.http_post(url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='fitstack_project_url') || '/functions/v1/weekly-backup',headers := jsonb_build_object('Content-Type','application/json','x-backup-secret',(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='fitstack_backup_cron_secret')),body := jsonb_build_object('scheduled_at',now()));$schedule$);
SELECT cron.schedule('fitstack-attendance-cleanup','15 20 1 * *',$schedule$DELETE FROM public.scan_events WHERE created_at < now()-interval '1 year'; DELETE FROM public.attendance WHERE check_in_at < now()-interval '1 year';$schedule$);
SELECT cron.schedule('fitstack-invoice-reset','30 18 1 1 *',$schedule$SELECT public.reset_invoice_counters();$schedule$);
