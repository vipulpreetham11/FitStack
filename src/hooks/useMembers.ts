import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useGym } from '@/hooks/useGym'


export type MemberRole = 'owner' | 'admin' | 'receptionist' | 'trainer' | 'member'
export type MembershipStatus = 'active' | 'frozen' | 'scheduled' | 'expired' | 'cancelled' | 'none'

export type MemberListItem = {
  id: string
  profile_id: string
  member_code: string | null
  role: MemberRole
  is_active: boolean
  joined_at: string
  profile: {
    full_name: string
    phone: string | null
    avatar_url: string | null
  }
  active_membership?: {
    id: string
    status: string
    end_date: string
    plan_name: string
  }
}

export function useMembers() {
  const { gym } = useGym()
  const [members, setMembers] = useState<MemberListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchMembers = useCallback(async () => {
    if (!gym || !supabase) return
    setLoading(true)
    setError(null)

    try {
      // Supabase PostgREST query to get members with their profiles and active memberships
      const { data, error: fetchError } = await supabase
        .from('gym_members')
        .select(`
          id, profile_id, member_code, role, is_active, joined_at,
          profiles ( full_name, phone, avatar_url ),
          memberships ( id, status, end_date, membership_plans ( name ) )
        `)
        .eq('gym_id', gym.gym_id)
        .eq('is_active', true)

      if (fetchError) throw fetchError

      const formattedMembers: MemberListItem[] = (data as any[]).map(row => {
        // Find an active/frozen/scheduled membership if any exists
        const mbs = Array.isArray(row.memberships) ? row.memberships : []
        const activeMb = mbs.find((m: any) => ['active', 'frozen', 'scheduled'].includes(m.status))
        
        return {
          id: row.id,
          profile_id: row.profile_id,
          member_code: row.member_code,
          role: row.role as MemberRole,
          is_active: row.is_active,
          joined_at: row.joined_at,
          profile: row.profiles,
          active_membership: activeMb ? {
            id: activeMb.id,
            status: activeMb.status,
            end_date: activeMb.end_date,
            plan_name: activeMb.membership_plans?.name || 'Unknown Plan'
          } : undefined
        }
      })

      // Default sort by name A-Z
      formattedMembers.sort((a, b) => a.profile.full_name.localeCompare(b.profile.full_name))
      setMembers(formattedMembers)
    } catch (err: any) {
      setError(err.message || 'Failed to fetch members')
    } finally {
      setLoading(false)
    }
  }, [gym])

  const fetchMember = useCallback(async (id: string) => {
    if (!gym || !supabase) throw new Error('Not initialized')
    
    const { data, error: fetchError } = await supabase
      .from('gym_members')
      .select(`
        *,
        profiles (*),
        memberships (*, membership_plans (name)),
        payments (*, invoices (id, invoice_number)),
        attendance (*)
      `)
      .eq('gym_id', gym.gym_id)
      .eq('id', id)
      .single()

    if (fetchError) throw fetchError
    return data as any
  }, [gym])

  const recordManualAttendance = useCallback(async (memberId: string) => {
    if (!gym || !supabase) throw new Error('Not initialized')
    
    const { error } = await supabase
      .from('attendance')
      .insert({
        gym_id: gym.gym_id,
        member_id: memberId,
        method: 'manual',
      })
      
    if (error) throw error
  }, [gym])

  const deactivateMember = useCallback(async (id: string) => {
    if (!gym || !supabase) throw new Error('Not initialized')
    
    const { error } = await supabase
      .from('gym_members')
      .update({ is_active: false })
      .eq('id', id)
      .eq('gym_id', gym.gym_id)
      
    if (error) throw error
    setMembers(prev => prev.filter(m => m.id !== id))
  }, [gym])

  return {
    members,
    loading,
    error,
    fetchMembers,
    fetchMember,
    recordManualAttendance,
    deactivateMember
  }
}
