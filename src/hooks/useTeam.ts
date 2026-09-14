import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useGym } from '@/hooks/useGym'
import { normalizeIdentity } from '@/lib/auth'
import type { MemberRole } from '@/hooks/useMembers'

type StaffRole = Exclude<MemberRole, 'member'>

export type TeamMember = {
  id: string
  gym_id: string
  profile_id: string
  role: MemberRole
  member_code: string | null
  is_active: boolean
  joined_at: string
  created_at: string
  updated_at: string
  profiles: {
    id: string
    full_name: string
    email: string | null
    phone: string | null
    avatar_url: string | null
  }
}

export function getAssignableRoles(role: string | null, isSuperAdmin = false): StaffRole[] {
  if (isSuperAdmin) return ['owner', 'admin', 'receptionist', 'trainer']
  if (role === 'owner') return ['admin', 'receptionist', 'trainer']
  if (role === 'admin') return ['receptionist', 'trainer']
  return []
}

export function useTeam(gymId?: string) {
  const { gym, role, isSuperAdmin } = useGym()
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const id = gymId ?? gym?.gym_id

  const refresh = useCallback(async () => {
    if (!id || !supabase) {
      setTeamMembers([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    const { data, error: queryError } = await supabase
      .from('gym_members')
      .select(`
        id,
        gym_id,
        profile_id,
        role,
        member_code,
        is_active,
        joined_at,
        created_at,
        updated_at,
        profiles!inner (
          id,
          full_name,
          email,
          phone,
          avatar_url
        )
      `)
      .eq('gym_id', id)
      .order('joined_at', { ascending: true })

    if (queryError) {
      setTeamMembers([])
      setError(queryError.message)
    } else {
      setTeamMembers((data ?? []) as unknown as TeamMember[])
    }
    setLoading(false)
  }, [id])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const updateActivation = useCallback(async (memberId: string, isActive: boolean) => {
    if (!id || !supabase) throw new Error('Supabase is not configured')

    const { data, error: updateError } = await supabase
      .from('gym_members')
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq('id', memberId)
      .eq('gym_id', id)
      .select('id')
      .maybeSingle()

    if (updateError) throw updateError
    if (!data) throw new Error('No team member was updated. Check your role and gym access.')
    await refresh()
  }, [id, refresh])

  const changeRole = useCallback(async (memberId: string, newRole: string) => {
    if (!id || !supabase) throw new Error('Supabase is not configured')

    const { error: roleError } = await (supabase as any).rpc('assign_gym_role', {
      p_gym_id: id,
      p_target_member_id: memberId,
      p_new_role: newRole,
    })

    if (roleError) throw roleError
    await refresh()
  }, [id, refresh])

  const addTeamMember = useCallback(async (
    phone: string,
    _name: string,
    _email: string,
    newRole: string,
  ) => {
    if (!id || !supabase) throw new Error('Supabase is not configured')
    const formattedPhone = normalizeIdentity(phone, 'phone')
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('phone', formattedPhone)
      .maybeSingle()

    if (profileError) throw profileError
    if (!profile) {
      throw new Error("This person hasn't signed up yet. Ask them to sign up at the join link first, then add them here.")
    }

    const { data: existing, error: existingError } = await supabase
      .from('gym_members')
      .select('id, role, is_active')
      .eq('gym_id', id)
      .eq('profile_id', profile.id)
      .maybeSingle()

    if (existingError) throw existingError
    if (existing?.is_active) throw new Error(`Already in your gym as ${existing.role}`)

    if (existing) {
      await changeRole(existing.id, newRole)
      await updateActivation(existing.id, true)
      return
    }

    const { error: insertError } = await supabase.from('gym_members').insert({
      gym_id: id,
      profile_id: profile.id,
      role: newRole,
      is_active: true,
    })
    if (insertError) throw insertError
    await refresh()
  }, [changeRole, id, refresh, updateActivation])

  return {
    teamMembers,
    loading,
    error,
    refresh,
    addTeamMember,
    changeRole,
    deactivateMember: (memberId: string) => updateActivation(memberId, false),
    reactivateMember: (memberId: string) => updateActivation(memberId, true),
    getAssignableRoles: () => getAssignableRoles(role, isSuperAdmin),
  }
}
