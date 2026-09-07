import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useGym } from '@/hooks/useGym'
import { addDays, daysBetween, toDateOnly, type MembershipStatus } from '@/lib/membership'
import type { Database, Json } from '@/types/database'

type MembershipRow = Database['public']['Tables']['memberships']['Row']
type PlanRow = Database['public']['Tables']['membership_plans']['Row']
type EventRow = Database['public']['Tables']['membership_events']['Row']

export type Membership = MembershipRow & {
  plan: PlanRow | null
  member: {
    id: string
    member_code: string | null
    profiles: { full_name: string; phone: string | null } | null
  } | null
}

export type MembershipEvent = EventRow & {
  actor?: { profiles: { full_name: string } | null } | null
}

export type CreateMembershipInput = {
  memberId: string
  planId: string
  startDate: string
  promoCode?: string
}

const membershipSelect = `
  *,
  plan:membership_plans!memberships_plan_id_fkey(*),
  member:gym_members!memberships_member_id_fkey(
    id, member_code, profiles(full_name, phone)
  )
`

export function useMemberships() {
  const { gym } = useGym()
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!gym || !supabase) {
      setMemberships([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    const { data, error: queryError } = await (supabase as any)
      .from('memberships')
      .select(membershipSelect)
      .eq('gym_id', gym.gym_id)
      .order('created_at', { ascending: false })
    if (queryError) {
      setError(queryError.message)
      setLoading(false)
      return
    }
    setMemberships((data ?? []) as Membership[])
    setLoading(false)
  }, [gym])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const getMemberMemberships = useCallback(async (memberId: string) => {
    if (!gym || !supabase) return []
    const { data, error: queryError } = await (supabase as any)
      .from('memberships')
      .select(membershipSelect)
      .eq('gym_id', gym.gym_id)
      .eq('member_id', memberId)
      .order('created_at', { ascending: false })
    if (queryError) throw queryError
    return (data ?? []) as Membership[]
  }, [gym])

  const getActiveMembership = useCallback(async (memberId: string) => {
    const rows = await getMemberMemberships(memberId)
    return rows.find(item => ['active', 'frozen'].includes(item.status)) ?? null
  }, [getMemberMemberships])

  const invoke = useCallback(async (body: Record<string, unknown>) => {
    if (!gym || !supabase) throw new Error('Supabase is not configured')
    const { data, error: functionError } = await supabase.functions.invoke('membership-lifecycle', {
      body: { ...body, gymId: gym.gym_id },
    })
    if (functionError) throw functionError
    if (data?.error) throw new Error(String(data.error))
    await refresh()
  }, [gym, refresh])

  const createMembership = useCallback((input: CreateMembershipInput) => invoke({
    action: 'create',
    memberId: input.memberId,
    planId: input.planId,
    startDate: input.startDate,
    promoCode: input.promoCode?.trim() || null,
  }), [invoke])

  const freezeMembership = useCallback((membershipId: string, days: number, reason?: string) => invoke({
    action: 'freeze', membershipId, days, reason: reason?.trim() || null,
  }), [invoke])

  const resumeMembership = useCallback((membershipId: string) => invoke({
    action: 'resume', membershipId,
  }), [invoke])

  const extendMembership = useCallback((membershipId: string, days: number, reason: string) => invoke({
    action: 'extend', membershipId, days, reason: reason.trim(),
  }), [invoke])

  const cancelMembership = useCallback((membershipId: string, reason: string) => invoke({
    action: 'cancel', membershipId, reason: reason.trim(),
  }), [invoke])

  const getMembershipEvents = useCallback(async (membershipId: string) => {
    if (!gym || !supabase) return []
    const { data, error: queryError } = await (supabase as any)
      .from('membership_events')
      .select('*, actor:gym_members!membership_events_performed_by_fkey(profiles(full_name))')
      .eq('gym_id', gym.gym_id)
      .eq('membership_id', membershipId)
      .order('created_at')
    if (queryError) throw queryError
    return (data ?? []) as MembershipEvent[]
  }, [gym])

  const stats = useMemo(() => {
    const today = toDateOnly()
    const inSevenDays = addDays(today, 7)
    const month = today.slice(0, 7)
    return {
      active: memberships.filter(item => item.status === 'active').length,
      expiringSoon: memberships.filter(item => item.status === 'active' && item.end_date >= today && item.end_date <= inSevenDays).length,
      expired: memberships.filter(item => item.status === 'expired' && item.end_date.startsWith(month)).length,
      frozen: memberships.filter(item => item.status === 'frozen').length,
    }
  }, [memberships])

  return {
    memberships,
    loading,
    error,
    refresh,
    getMemberMemberships,
    getActiveMembership,
    createMembership,
    freezeMembership,
    resumeMembership,
    extendMembership,
    cancelMembership,
    getMembershipEvents,
    stats,
  }
}

export function eventDetails(value: Json) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

export function membershipDaysRemaining(item: Pick<MembershipRow, 'status' | 'end_date'>) {
  return item.status === 'frozen' ? 'Paused' : item.status === 'expired' ? '0' : String(Math.max(0, daysBetween(toDateOnly(), item.end_date) + 1))
}

export function asMembershipStatus(value: string): MembershipStatus {
  return value as MembershipStatus
}
