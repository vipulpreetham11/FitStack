BEGIN;

CREATE OR REPLACE FUNCTION public.run_membership_lifecycle()
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  member_row record;
  membership_row public.memberships%ROWTYPE;
  freeze_row public.membership_freezes%ROWTYPE;
  next_status text;
  actual_freeze_days integer;
  expired_count integer := 0;
  activated_count integer := 0;
  resumed_count integer := 0;
  errors jsonb := '[]'::jsonb;
BEGIN
  FOR member_row IN
    SELECT DISTINCT member_id
    FROM public.memberships
    WHERE status IN ('active', 'frozen', 'scheduled')
    ORDER BY member_id
  LOOP
    BEGIN
      -- Serialise lifecycle work for one member so renewals cannot overlap.
      PERFORM 1
      FROM public.gym_members
      WHERE id = member_row.member_id
      FOR UPDATE;

      FOR membership_row IN
        SELECT *
        FROM public.memberships
        WHERE member_id = member_row.member_id
          AND status = 'active'
          AND end_date < today
        FOR UPDATE
      LOOP
        UPDATE public.memberships
        SET status = 'expired', updated_at = now()
        WHERE id = membership_row.id;

        INSERT INTO public.membership_events (
          gym_id, membership_id, event_type, from_status, to_status, performed_by, details
        ) VALUES (
          membership_row.gym_id,
          membership_row.id,
          'expired',
          'active',
          'expired',
          NULL,
          jsonb_build_object('reason', 'Auto-expired by system')
        );
        expired_count := expired_count + 1;
      END LOOP;

      -- Freeze already extends end_date by the planned duration. Auto-resume only
      -- closes the freeze record; extending again here would double-count days.
      FOR membership_row IN
        SELECT *
        FROM public.memberships
        WHERE member_id = member_row.member_id
          AND status = 'frozen'
          AND frozen_until <= today
        FOR UPDATE
      LOOP
        freeze_row := NULL;
        SELECT *
        INTO freeze_row
        FROM public.membership_freezes
        WHERE membership_id = membership_row.id
          AND resume_at IS NULL
        ORDER BY frozen_at DESC
        LIMIT 1
        FOR UPDATE;

        actual_freeze_days := COALESCE(
          freeze_row.planned_days,
          GREATEST(
            0,
            membership_row.frozen_until -
              (membership_row.frozen_at AT TIME ZONE 'Asia/Kolkata')::date
          )
        );

        IF freeze_row.id IS NOT NULL THEN
          UPDATE public.membership_freezes
          SET resume_at = membership_row.frozen_until::timestamp AT TIME ZONE 'Asia/Kolkata',
              actual_days = actual_freeze_days,
              resumed_early = false
          WHERE id = freeze_row.id;
        END IF;

        next_status := CASE WHEN membership_row.end_date < today THEN 'expired' ELSE 'active' END;
        UPDATE public.memberships
        SET status = next_status,
            frozen_at = NULL,
            frozen_until = NULL,
            total_freeze_days = total_freeze_days + actual_freeze_days,
            updated_at = now()
        WHERE id = membership_row.id;

        INSERT INTO public.membership_events (
          gym_id, membership_id, event_type, from_status, to_status, performed_by, details
        ) VALUES (
          membership_row.gym_id,
          membership_row.id,
          CASE WHEN next_status = 'expired' THEN 'expired' ELSE 'resumed' END,
          'frozen',
          next_status,
          NULL,
          jsonb_build_object(
            'reason',
            CASE
              WHEN next_status = 'expired' THEN 'Auto-expired by system after freeze ended'
              ELSE 'Auto-resumed by system after freeze ended'
            END,
            'actual_days', actual_freeze_days
          )
        );

        IF next_status = 'expired' THEN
          expired_count := expired_count + 1;
        ELSE
          resumed_count := resumed_count + 1;
        END IF;
      END LOOP;

      PERFORM public.sync_scheduled_renewal(member_row.member_id);

      FOR membership_row IN
        SELECT *
        FROM public.memberships
        WHERE member_id = member_row.member_id
          AND status = 'scheduled'
          AND start_date <= today
        FOR UPDATE
      LOOP
        IF EXISTS (
          SELECT 1
          FROM public.memberships
          WHERE member_id = member_row.member_id
            AND status IN ('active', 'frozen')
        ) THEN
          CONTINUE;
        END IF;

        next_status := CASE WHEN membership_row.end_date < today THEN 'expired' ELSE 'active' END;
        UPDATE public.memberships
        SET status = next_status, updated_at = now()
        WHERE id = membership_row.id;

        INSERT INTO public.membership_events (
          gym_id, membership_id, event_type, from_status, to_status, performed_by, details
        ) VALUES (
          membership_row.gym_id,
          membership_row.id,
          CASE WHEN next_status = 'expired' THEN 'expired' ELSE 'activated' END,
          'scheduled',
          next_status,
          NULL,
          jsonb_build_object(
            'reason',
            CASE
              WHEN next_status = 'expired' THEN 'Auto-expired by system before activation'
              ELSE 'Auto-activated by system'
            END
          )
        );

        IF next_status = 'expired' THEN
          expired_count := expired_count + 1;
        ELSE
          activated_count := activated_count + 1;
        END IF;
      END LOOP;
    EXCEPTION WHEN OTHERS THEN
      errors := errors || jsonb_build_array(
        format('Member %s: %s', member_row.member_id, SQLERRM)
      );
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'expired', expired_count,
    'activated', activated_count,
    'resumed', resumed_count,
    'errors', errors
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.process_daily_memberships()
RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  PERFORM public.run_membership_lifecycle();
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_membership_cron_secret(p_secret text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT p_secret IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM vault.decrypted_secrets
      WHERE name = 'FITSTACK_MEMBERSHIP_CRON_SECRET'
        AND decrypted_secret = p_secret
    );
$$;

REVOKE ALL ON FUNCTION public.run_membership_lifecycle() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_membership_lifecycle() TO service_role;
REVOKE ALL ON FUNCTION public.process_daily_memberships() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_daily_memberships() TO service_role;
REVOKE ALL ON FUNCTION public.verify_membership_cron_secret(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_membership_cron_secret(text) TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'SUPABASE_URL') THEN
    PERFORM vault.create_secret(
      'https://sryrjeyuixsrhqgqglqb.supabase.co',
      'SUPABASE_URL',
      'FitStack project URL for internal scheduled Edge Function calls',
      NULL
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'FITSTACK_MEMBERSHIP_CRON_SECRET') THEN
    PERFORM vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'FITSTACK_MEMBERSHIP_CRON_SECRET',
      'Shared secret for the FitStack membership lifecycle cron',
      NULL
    );
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
COMMIT;

-- Scheduling is intentionally outside the transaction because cron.schedule
-- manages its own job metadata. 18:30 UTC is 00:00 Asia/Kolkata.
DO $$
DECLARE
  job record;
BEGIN
  FOR job IN
    SELECT jobid
    FROM cron.job
    WHERE jobname IN ('fitstack-daily-memberships', 'process_daily_memberships')
  LOOP
    PERFORM cron.unschedule(job.jobid);
  END LOOP;
END;
$$;

SELECT cron.schedule(
  'process_daily_memberships',
  '30 18 * * *',
  $schedule$
  SELECT net.http_post(
    url := (
      SELECT decrypted_secret
      FROM vault.decrypted_secrets
      WHERE name = 'SUPABASE_URL'
    ) || '/functions/v1/membership-lifecycle',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name = 'FITSTACK_MEMBERSHIP_CRON_SECRET'
      ),
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object('action', 'process-daily')
  );
  $schedule$
);
