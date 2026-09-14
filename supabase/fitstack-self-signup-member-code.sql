-- Additive production patch: assign a member code atomically during self-signup.
-- Run after fitstack-v1.sql and fitstack-module3-auth.sql.
BEGIN;

CREATE OR REPLACE FUNCTION private.join_gym(p_slug text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
  target_id uuid;
  new_member_id uuid;
  member_name text;
  existing public.gym_members%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS(SELECT 1 FROM auth.users u WHERE u.id=auth.uid() AND NOT coalesce(u.is_anonymous,false) AND (u.email_confirmed_at IS NOT NULL OR u.phone_confirmed_at IS NOT NULL)) THEN
    RAISE EXCEPTION 'A verified identity is required' USING ERRCODE='42501';
  END IF;
  SELECT p.full_name INTO member_name FROM public.profiles p
  WHERE p.id=auth.uid() AND length(btrim(p.full_name))>=2 AND lower(btrim(p.full_name))<>'new user';
  IF member_name IS NULL THEN RAISE EXCEPTION 'Complete your profile before joining'; END IF;
  SELECT g.id INTO target_id FROM public.gyms g WHERE g.slug=p_slug AND g.is_active FOR UPDATE;
  IF target_id IS NULL THEN RAISE EXCEPTION 'Gym not found or inactive'; END IF;
  SELECT * INTO existing FROM public.gym_members m WHERE m.gym_id=target_id AND m.profile_id=auth.uid() FOR UPDATE;
  IF FOUND THEN
    IF NOT existing.is_active THEN RAISE EXCEPTION 'Gym access is inactive. Please contact your gym.' USING ERRCODE='42501'; END IF;
    RETURN target_id;
  END IF;
  new_member_id := gen_random_uuid();
  INSERT INTO public.gym_members(id,gym_id,profile_id,role,member_code)
  VALUES(
    new_member_id,
    target_id,
    auth.uid(),
    'member',
    upper(substring(btrim(member_name) FROM 1 FOR 3))
      || upper(right(replace(new_member_id::text, '-', ''), 4))
  )
  ON CONFLICT(gym_id,profile_id) DO NOTHING;
  RETURN target_id;
END;
$$;

NOTIFY pgrst,'reload schema';
COMMIT;
