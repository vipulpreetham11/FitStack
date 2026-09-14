-- Module 3 additive update. Run AFTER fitstack-v1.sql in the Supabase SQL Editor.
-- No existing tables, identities, or business records are replaced.
BEGIN;

-- Provision only the caller, from verified Auth identity fields (never user_metadata).
-- profiles.phone is already nullable in V1: email-only users keep NULL, never fake phones.
CREATE OR REPLACE FUNCTION private.ensure_my_profile() RETURNS SETOF public.profiles
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE u auth.users%ROWTYPE; verified_phone text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE='42501'; END IF;
  SELECT * INTO u FROM auth.users WHERE id=auth.uid();
  IF NOT FOUND OR (u.email_confirmed_at IS NULL AND u.phone_confirmed_at IS NULL) OR coalesce(u.is_anonymous,false) THEN
    RAISE EXCEPTION 'A verified identity is required' USING ERRCODE='42501';
  END IF;
  IF u.phone_confirmed_at IS NOT NULL AND nullif(u.phone,'') IS NOT NULL THEN
    verified_phone := '+' || ltrim(u.phone,'+');
  END IF;
  INSERT INTO public.profiles(id,phone,email,full_name)
  VALUES(u.id,verified_phone,CASE WHEN u.email_confirmed_at IS NOT NULL THEN nullif(u.email,'') END,'New User')
  ON CONFLICT(id) DO NOTHING;
  RETURN QUERY SELECT p.* FROM public.profiles p WHERE p.id=u.id;
END;
$$;
CREATE OR REPLACE FUNCTION public.ensure_my_profile() RETURNS SETOF public.profiles
LANGUAGE sql SECURITY INVOKER SET search_path = pg_catalog AS $$ SELECT * FROM private.ensure_my_profile(); $$;

-- Deliberately public: only active gym branding, one exact slug. No contact, settings,
-- financial, membership, or credential fields. This is NOT general table SELECT access.
CREATE OR REPLACE FUNCTION private.get_join_gym(p_slug text)
RETURNS TABLE(id uuid,name text,slug text,logo_url text,brand_color text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
 SELECT g.id,g.name,g.slug,g.logo_url,g.brand_color FROM public.gyms g
 WHERE g.slug=p_slug AND g.is_active AND length(p_slug) BETWEEN 1 AND 160;
$$;
CREATE OR REPLACE FUNCTION public.get_join_gym(p_slug text)
RETURNS TABLE(id uuid,name text,slug text,logo_url text,brand_color text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = pg_catalog AS $$ SELECT * FROM private.get_join_gym(p_slug); $$;

-- Own access summary stays visible when a gym is inactive, so the UI can explain
-- blocked access. It does not unlock RLS on any business table or reveal QR secrets.
CREATE OR REPLACE FUNCTION private.get_my_gym_access()
RETURNS TABLE(id uuid,gym_id uuid,profile_id uuid,role text,member_code text,member_is_active boolean,joined_at timestamptz,created_at timestamptz,updated_at timestamptz,name text,slug text,logo_url text,brand_color text,is_active boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
 SELECT m.id,m.gym_id,m.profile_id,m.role,m.member_code,m.is_active,m.joined_at,m.created_at,m.updated_at,g.name,g.slug,g.logo_url,g.brand_color,g.is_active
 FROM public.gym_members m JOIN public.gyms g ON g.id=m.gym_id
 WHERE auth.uid() IS NOT NULL AND m.profile_id=auth.uid() AND m.is_active
 ORDER BY g.name,g.id;
$$;
CREATE OR REPLACE FUNCTION public.get_my_gym_access()
RETURNS TABLE(id uuid,gym_id uuid,profile_id uuid,role text,member_code text,member_is_active boolean,joined_at timestamptz,created_at timestamptz,updated_at timestamptz,name text,slug text,logo_url text,brand_color text,is_active boolean)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = pg_catalog AS $$ SELECT * FROM private.get_my_gym_access(); $$;

-- Self-join only: role, profile_id, QR secret and activation state cannot be supplied.
-- Serializes joins for the same gym; retries preserve existing staff roles and codes.
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
  IF member_name IS NULL THEN
    RAISE EXCEPTION 'Complete your profile before joining';
  END IF;
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
CREATE OR REPLACE FUNCTION public.join_gym(p_slug text) RETURNS uuid
LANGUAGE sql SECURITY INVOKER SET search_path = pg_catalog AS $$ SELECT private.join_gym(p_slug); $$;

REVOKE ALL ON FUNCTION private.ensure_my_profile(),public.ensure_my_profile(),private.get_my_gym_access(),public.get_my_gym_access(),private.join_gym(text),public.join_gym(text),private.get_join_gym(text),public.get_join_gym(text) FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA public,private TO anon,authenticated;
GRANT EXECUTE ON FUNCTION private.get_join_gym(text),public.get_join_gym(text) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION private.ensure_my_profile(),public.ensure_my_profile(),private.get_my_gym_access(),public.get_my_gym_access(),private.join_gym(text),public.join_gym(text) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
