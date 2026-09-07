import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useGym } from '@/hooks/useGym'
import { toDateOnly, addDays } from '@/lib/membership'
import type { Membership } from '@/hooks/useMemberships'

export type ActivityItem = {
  id: string
  type: 'checkin' | 'payment' | 'new_member'
  label: string
  timestamp: string
}

export function useDashboard() {
  const { gym } = useGym()
  const [liveHeadcount, setLiveHeadcount] = useState(0)
  const [activeMembers, setActiveMembers] = useState(0)
  const [expiringSoon, setExpiringSoon] = useState<Membership[]>([])
  const [revenueThisMonth, setRevenueThisMonth] = useState(0)
  const [revenueByDay, setRevenueByDay] = useState<{ date: string; amount: number }[]>([])
  const [attendanceByDay, setAttendanceByDay] = useState<{ date: string; count: number }[]>([])
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([])
  const [newMembersThisMonth, setNewMembersThisMonth] = useState(0)
  const [membershipsSoldThisMonth, setMembershipsSoldThisMonth] = useState(0)
  const [failedPayments, setFailedPayments] = useState(0)
  const [frozenMembers, setFrozenMembers] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const channelRef = useRef<ReturnType<NonNullable<typeof supabase>['channel']> | null>(null)

  const refresh = useCallback(async () => {
    if (!gym || !supabase) { setLoading(false); return }
    setLoading(true); setError(null)
    try {
      const today = toDateOnly()
      const monthStart = today.slice(0, 7) + '-01'
      const fourHoursAgo = new Date(Date.now() - 4 * 3600000).toISOString()
      const inSevenDays = addDays(today, 7)
      const thirtyDaysAgo = addDays(today, -29)
      const fourteenDaysAgo = addDays(today, -13)

      const [
        { data: headcountData },
        { data: activeMembershipsData },
        { data: expiringSoonData },
        { data: revenueData },
        { data: revByDayData },
        { data: attByDayData },
        { data: activityCheckins },
        { data: activityPayments },
        { data: activityMembers },
        { data: newMembersData },
        { data: failedData },
        { data: frozenData },
        { data: soldData },
      ] = await Promise.all([
        (supabase as any).from('attendance').select('id', { count: 'exact', head: true }).eq('gym_id', gym.gym_id).gte('check_in_at', fourHoursAgo),
        (supabase as any).from('memberships').select('id', { count: 'exact', head: true }).eq('gym_id', gym.gym_id).eq('status', 'active'),
        (supabase as any).from('memberships').select(`*, plan:membership_plans!memberships_plan_id_fkey(*), member:gym_members!memberships_member_id_fkey(id, member_code, profiles(full_name, phone))`).eq('gym_id', gym.gym_id).eq('status', 'active').gte('end_date', today).lte('end_date', inSevenDays).order('end_date').limit(10),
        (supabase as any).from('payments').select('total_amount').eq('gym_id', gym.gym_id).eq('status', 'captured').gte('created_at', `${monthStart}T00:00:00+05:30`),
        (supabase as any).from('payments').select('created_at, total_amount').eq('gym_id', gym.gym_id).eq('status', 'captured').gte('created_at', `${thirtyDaysAgo}T00:00:00+05:30`).order('created_at'),
        (supabase as any).from('attendance').select('check_in_at').eq('gym_id', gym.gym_id).gte('check_in_at', `${fourteenDaysAgo}T00:00:00+05:30`).order('check_in_at'),
        (supabase as any).from('attendance').select('id, check_in_at, member:gym_members!attendance_member_id_fkey(profiles(full_name))').eq('gym_id', gym.gym_id).order('check_in_at', { ascending: false }).limit(7),
        (supabase as any).from('payments').select('id, created_at, description, member:gym_members!payments_member_id_fkey(profiles(full_name))').eq('gym_id', gym.gym_id).eq('status', 'captured').order('created_at', { ascending: false }).limit(7),
        (supabase as any).from('gym_members').select('id, joined_at, profiles(full_name)').eq('gym_id', gym.gym_id).gte('joined_at', `${monthStart}T00:00:00+05:30`).order('joined_at', { ascending: false }).limit(7),
        (supabase as any).from('gym_members').select('id', { count: 'exact', head: true }).eq('gym_id', gym.gym_id).gte('joined_at', `${monthStart}T00:00:00+05:30`),
        (supabase as any).from('payments').select('id', { count: 'exact', head: true }).eq('gym_id', gym.gym_id).eq('status', 'failed').gte('created_at', `${monthStart}T00:00:00+05:30`),
        (supabase as any).from('memberships').select('id', { count: 'exact', head: true }).eq('gym_id', gym.gym_id).eq('status', 'frozen'),
        (supabase as any).from('memberships').select('id', { count: 'exact', head: true }).eq('gym_id', gym.gym_id).gte('created_at', `${monthStart}T00:00:00+05:30`),
      ])

      setLiveHeadcount(headcountData?.length ?? 0)
      setActiveMembers(activeMembershipsData?.length ?? 0)
      setExpiringSoon((expiringSoonData ?? []) as Membership[])
      setRevenueThisMonth((revenueData ?? []).reduce((s: number, p: any) => s + Number(p.total_amount), 0))
      setNewMembersThisMonth(newMembersData?.length ?? 0)
      setFailedPayments(failedData?.length ?? 0)
      setFrozenMembers(frozenData?.length ?? 0)
      setMembershipsSoldThisMonth(soldData?.length ?? 0)

      // Revenue by day (last 30 days)
      const revMap: Record<string, number> = {}
      for (let i = 0; i < 30; i++) revMap[addDays(today, -29 + i)] = 0
      for (const p of (revByDayData ?? [])) {
        const d = new Date(p.created_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
        if (revMap[d] !== undefined) revMap[d] += Number(p.total_amount)
      }
      setRevenueByDay(Object.entries(revMap).map(([date, amount]) => ({ date, amount })))

      // Attendance by day (last 14 days)
      const attMap: Record<string, number> = {}
      for (let i = 0; i < 14; i++) attMap[addDays(today, -13 + i)] = 0
      for (const a of (attByDayData ?? [])) {
        const d = new Date(a.check_in_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
        if (attMap[d] !== undefined) attMap[d]++
      }
      setAttendanceByDay(Object.entries(attMap).map(([date, count]) => ({ date, count })))

      // Recent activity feed
      const activity: ActivityItem[] = []
      for (const a of (activityCheckins ?? [])) {
        const name = (a.member as any)?.profiles?.full_name ?? 'Unknown'
        activity.push({ id: `chk-${a.id}`, type: 'checkin', label: `${name} checked in`, timestamp: a.check_in_at })
      }
      for (const p of (activityPayments ?? [])) {
        const name = (p.member as any)?.profiles?.full_name ?? 'Unknown'
        activity.push({ id: `pay-${p.id}`, type: 'payment', label: `${name} purchased ${p.description ?? 'a plan'}`, timestamp: p.created_at })
      }
      for (const m of (activityMembers ?? [])) {
        const name = (m.profiles as any)?.full_name ?? 'Unknown'
        activity.push({ id: `mbr-${m.id}`, type: 'new_member', label: `New member: ${name} joined`, timestamp: m.joined_at })
      }
      activity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      setRecentActivity(activity.slice(0, 20))
    } catch (err: any) {
      setError(err.message ?? 'Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }, [gym])

  useEffect(() => { void refresh() }, [refresh])

  const subscribeToRealtime = useCallback(() => {
    if (!gym || !supabase) return
    if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null }
    const channel = supabase
      .channel(`dashboard-live-${gym.gym_id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'attendance', filter: `gym_id=eq.${gym.gym_id}` }, () => void refresh())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'payments', filter: `gym_id=eq.${gym.gym_id}` }, () => void refresh())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'gym_members', filter: `gym_id=eq.${gym.gym_id}` }, () => void refresh())
      .subscribe()
    channelRef.current = channel
    return () => { if (supabase && channelRef.current) supabase.removeChannel(channelRef.current) }
  }, [gym, refresh])

  useEffect(() => {
    const unsub = subscribeToRealtime()
    return unsub
  }, [subscribeToRealtime])

  return {
    liveHeadcount, activeMembers, expiringSoon, revenueThisMonth,
    revenueByDay, attendanceByDay, recentActivity,
    newMembersThisMonth, membershipsSoldThisMonth, failedPayments, frozenMembers,
    loading, error, refresh, subscribeToRealtime,
  }
}
