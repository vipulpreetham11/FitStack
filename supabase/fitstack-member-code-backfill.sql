-- One-time, rerunnable backfill for self-signup members created without a member code.
-- Run in the Supabase SQL Editor after reviewing the collision check below.
BEGIN;

DO $$
DECLARE
  conflicting_code text;
BEGIN
  WITH proposed AS (
    SELECT
      gm.id,
      gm.gym_id,
      upper(substring(btrim(p.full_name) FROM 1 FOR 3))
        || upper(right(replace(gm.id::text, '-', ''), 4)) AS member_code
    FROM public.gym_members gm
    JOIN public.profiles p ON p.id = gm.profile_id
    WHERE gm.role = 'member'
      AND gm.member_code IS NULL
  ), conflicts AS (
    SELECT proposed.member_code
    FROM proposed
    LEFT JOIN public.gym_members existing
      ON existing.gym_id = proposed.gym_id
     AND existing.member_code = proposed.member_code
     AND existing.id <> proposed.id
    GROUP BY proposed.gym_id, proposed.member_code
    HAVING count(*) > 1 OR count(existing.id) > 0
  )
  SELECT member_code INTO conflicting_code FROM conflicts LIMIT 1;

  IF conflicting_code IS NOT NULL THEN
    RAISE EXCEPTION 'Member-code collision detected for %. No rows were changed.', conflicting_code;
  END IF;
END;
$$;

UPDATE public.gym_members gm
SET
  member_code = upper(substring(btrim(p.full_name) FROM 1 FOR 3))
    || upper(right(replace(gm.id::text, '-', ''), 4)),
  updated_at = now()
FROM public.profiles p
WHERE p.id = gm.profile_id
  AND gm.role = 'member'
  AND gm.member_code IS NULL;

COMMIT;
