begin;

create or replace function public.manual_member_checkin(
  p_gym_id uuid,
  p_member_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_actor_id uuid;
  v_actor_role text;
  v_member_active boolean;
  v_membership_status text;
  v_start_date date;
  v_end_date date;
  v_last_check_in timestamptz;
  v_checked_in_at timestamptz := now();
  v_attendance_id uuid;
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
  v_elapsed_minutes integer;
  v_reason text;
begin
  if auth.uid() is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;

  select gm.id, gm.role
  into v_actor_id, v_actor_role
  from public.gym_members gm
  where gm.gym_id = p_gym_id
    and gm.profile_id = auth.uid()
    and gm.is_active = true;

  if v_actor_role is null or v_actor_role not in ('owner', 'admin', 'receptionist') then
    raise exception 'Only owners, administrators, and receptionists can check in members'
      using errcode = '42501';
  end if;

  select gm.is_active
  into v_member_active
  from public.gym_members gm
  where gm.id = p_member_id
    and gm.gym_id = p_gym_id
    and gm.role = 'member';

  if v_member_active is distinct from true then
    return jsonb_build_object('result', 'denied', 'reason', 'Member is inactive');
  end if;

  select m.status, m.start_date, m.end_date
  into v_membership_status, v_start_date, v_end_date
  from public.memberships m
  where m.gym_id = p_gym_id
    and m.member_id = p_member_id
  order by
    case m.status
      when 'active' then 0
      when 'frozen' then 1
      when 'scheduled' then 2
      else 3
    end,
    m.created_at desc
  limit 1;

  if not found then
    return jsonb_build_object('result', 'denied', 'reason', 'No active membership');
  end if;

  if v_membership_status = 'frozen' then
    return jsonb_build_object('result', 'denied', 'reason', 'Membership frozen');
  elsif v_membership_status = 'scheduled' or v_start_date > v_today then
    return jsonb_build_object('result', 'denied', 'reason', 'Membership has not started');
  elsif v_membership_status = 'cancelled' then
    return jsonb_build_object('result', 'denied', 'reason', 'Membership cancelled');
  elsif v_membership_status <> 'active' or v_end_date < v_today then
    return jsonb_build_object('result', 'denied', 'reason', 'Membership expired');
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_gym_id::text || ':' || p_member_id::text, 0)
  );

  select a.check_in_at
  into v_last_check_in
  from public.attendance a
  where a.gym_id = p_gym_id
    and a.member_id = p_member_id
    and a.check_in_at > v_checked_in_at - interval '4 hours'
  order by a.check_in_at desc
  limit 1;

  if found then
    v_elapsed_minutes := greatest(
      0,
      floor(extract(epoch from (v_checked_in_at - v_last_check_in)) / 60)::integer
    );
    v_reason := case
      when v_elapsed_minutes < 60 then format(
        'Already checked in (%s %s ago)',
        greatest(1, v_elapsed_minutes),
        case when v_elapsed_minutes <= 1 then 'minute' else 'minutes' end
      )
      else format(
        'Already checked in (%s %s ago)',
        trim(to_char(v_elapsed_minutes / 60.0, 'FM999990.0')),
        case when v_elapsed_minutes < 90 then 'hour' else 'hours' end
      )
    end;
    return jsonb_build_object('result', 'denied', 'reason', v_reason);
  end if;

  insert into public.attendance(
    gym_id,
    member_id,
    check_in_at,
    method,
    checked_in_by
  ) values (
    p_gym_id,
    p_member_id,
    v_checked_in_at,
    'manual',
    v_actor_id
  )
  returning id into v_attendance_id;

  return jsonb_build_object(
    'result', 'allowed',
    'attendance_id', v_attendance_id,
    'checked_in_at', v_checked_in_at
  );
end;
$$;

commit;
