import { useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useGym } from '@/hooks/useGym'

export type QuickCheckInMembership = {
  id: string
  status: string
  start_date: string
  end_date: string
  plan_id: string
  membership_plans: { name: string } | null
}

export type QuickCheckInMember = {
  id: string
  role: string
  is_active: boolean
  profiles: {
    full_name: string
    phone: string | null
    avatar_url: string | null
  }
  memberships: QuickCheckInMembership[]
}

export type ManualCheckInResult = {
  result: 'allowed' | 'denied'
  reason?: string
  attendance_id?: string
  checked_in_at?: string
}

function cleanSearchTerm(value: string) {
  return value.trim().replace(/[,%()\\]/g, ' ').replace(/\s+/g, ' ')
}

export function useQuickCheckIn() {
  const { gym } = useGym()

  const searchMembers = useCallback(async (value: string): Promise<QuickCheckInMember[]> => {
    const term = cleanSearchTerm(value)
    if (!gym || !supabase || !term) return []

    const { data, error } = await (supabase as any)
      .from('gym_members')
      .select(`
        id,
        role,
        is_active,
        profiles!inner(full_name, phone, avatar_url),
        memberships!memberships_member_id_fkey(
          id,
          status,
          start_date,
          end_date,
          plan_id,
          membership_plans!memberships_plan_id_fkey(name)
        )
      `)
      .eq('gym_id', gym.gym_id)
      .eq('role', 'member')
      .eq('is_active', true)
      .or(`full_name.ilike.%${term}%,phone.ilike.%${term}%`, { referencedTable: 'profiles' })
      .order('full_name', { referencedTable: 'profiles' })
      .limit(5)

    if (error) throw error

    return (data ?? []).map((row: any) => ({
      ...row,
      profiles: Array.isArray(row.profiles) ? row.profiles[0] : row.profiles,
      memberships: (row.memberships ?? []).map((membership: any) => ({
        ...membership,
        membership_plans: Array.isArray(membership.membership_plans)
          ? membership.membership_plans[0] ?? null
          : membership.membership_plans ?? null,
      })),
    })) as QuickCheckInMember[]
  }, [gym])

  const checkIn = useCallback(async (memberId: string): Promise<ManualCheckInResult> => {
    if (!gym || !supabase) throw new Error('Attendance is not initialized')
    const { data, error } = await (supabase as any).rpc('manual_member_checkin', {
      p_gym_id: gym.gym_id,
      p_member_id: memberId,
    })
    if (error) throw error

    let result = data
    if (typeof result === 'string') result = JSON.parse(result)
    if (!result || (result.result !== 'allowed' && result.result !== 'denied')) {
      throw new Error('Check-in returned an invalid response')
    }
    return result as ManualCheckInResult
  }, [gym])

  return { searchMembers, checkIn }
}
