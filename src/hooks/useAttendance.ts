import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useGym } from '@/hooks/useGym'
import { toDateOnly } from '@/lib/membership'
import type { Database } from '@/types/database'

type AttendanceRow = Database['public']['Tables']['attendance']['Row']
export type Attendance = AttendanceRow & {
  member: {
    id: string
    member_code: string | null
    profiles: { full_name: string; avatar_url: string | null } | null
  } | null
  plan_name?: string | null
}

const attendanceSelect = `
  *,
  member:gym_members!attendance_member_id_fkey(
    id, member_code, profiles(full_name, avatar_url)
  )
`

export function useAttendance() {
  const { gym } = useGym()
  const [todayAttendance, setTodayAttendance] = useState<Attendance[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const channelRef = useRef<ReturnType<NonNullable<typeof supabase>['channel']> | null>(null)

  const refresh = useCallback(async () => {
    if (!gym || !supabase) { setTodayAttendance([]); setLoading(false); return }
    setLoading(true); setError(null)
    const today = toDateOnly()
    const { data, error: queryError } = await (supabase as any)
      .from('attendance')
      .select(attendanceSelect)
      .eq('gym_id', gym.gym_id)
      .gte('check_in_at', `${today}T00:00:00+05:30`)
      .lte('check_in_at', `${today}T23:59:59+05:30`)
      .order('check_in_at', { ascending: false })
    if (queryError) { setError(queryError.message); setLoading(false); return }
    setTodayAttendance((data ?? []) as Attendance[])
    setLoading(false)
  }, [gym])

  useEffect(() => { void refresh() }, [refresh])

  const getAttendanceHistory = useCallback(async (startDate: string, endDate: string): Promise<Attendance[]> => {
    if (!gym || !supabase) return []
    const { data, error: queryError } = await (supabase as any)
      .from('attendance')
      .select(attendanceSelect)
      .eq('gym_id', gym.gym_id)
      .gte('check_in_at', `${startDate}T00:00:00+05:30`)
      .lte('check_in_at', `${endDate}T23:59:59+05:30`)
      .order('check_in_at', { ascending: false })
    if (queryError) throw queryError
    return (data ?? []) as Attendance[]
  }, [gym])

  const getMemberAttendance = useCallback(async (memberId: string, limit = 50): Promise<Attendance[]> => {
    if (!gym || !supabase) return []
    const { data, error: queryError } = await (supabase as any)
      .from('attendance')
      .select(attendanceSelect)
      .eq('gym_id', gym.gym_id)
      .eq('member_id', memberId)
      .order('check_in_at', { ascending: false })
      .limit(limit)
    if (queryError) throw queryError
    return (data ?? []) as Attendance[]
  }, [gym])

  const recordManualAttendance = useCallback(async (memberId: string) => {
    if (!gym || !supabase) throw new Error('Not initialized')
    const { error } = await supabase.from('attendance').insert({ gym_id: gym.gym_id, member_id: memberId, method: 'manual' })
    if (error) throw error
    await refresh()
  }, [gym, refresh])

  const subscribeToRealtime = useCallback(() => {
    if (!gym || !supabase) return
    if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null }
    const channel = supabase
      .channel(`attendance-live-${gym.gym_id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'attendance', filter: `gym_id=eq.${gym.gym_id}` }, () => { void refresh() })
      .subscribe()
    channelRef.current = channel
    return () => { if (supabase && channelRef.current) supabase.removeChannel(channelRef.current) }
  }, [gym, refresh])

  useEffect(() => {
    const unsub = subscribeToRealtime()
    return unsub
  }, [subscribeToRealtime])

  const stats = useMemo(() => {
    const fourHoursAgo = new Date(Date.now() - 4 * 3600000)
    const memberIds = new Set(todayAttendance.map(a => a.member_id))
    return {
      currentlyIn: todayAttendance.filter(a => new Date(a.check_in_at) >= fourHoursAgo).length,
      totalToday: todayAttendance.length,
      uniqueToday: memberIds.size,
    }
  }, [todayAttendance])

  return { todayAttendance, loading, error, refresh, recordManualAttendance, getAttendanceHistory, getMemberAttendance, subscribeToRealtime, stats }
}
