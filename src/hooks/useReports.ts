import { useCallback, useEffect, useMemo, useState } from 'react'
import { useGym } from '@/hooks/useGym'
import { supabase } from '@/lib/supabase'
import { daysBetween, toDateOnly } from '@/lib/membership'
import { reportRange, type DateRange, type ReportPeriod } from '@/lib/reports'
export { reportRange }
export type { DateRange, ReportPeriod }

function istDate(value: string) { return new Date(value).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) }
function istHour(value: string) { return Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', hourCycle: 'h23' }).format(new Date(value))) }
function useRange(period: ReportPeriod, custom: DateRange) { return useMemo(() => reportRange(period, { from: custom.from, to: custom.to }), [period, custom.from, custom.to]) }
function useReportState<T>(loader: () => Promise<T>, empty: T) {
  const [data, setData] = useState<T>(empty); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null)
  const refresh = useCallback(async () => { setLoading(true); setError(null); try { setData(await loader()) } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not load report') } finally { setLoading(false) } }, [loader])
  useEffect(() => { void refresh() }, [refresh])
  return { data, loading, error, refresh }
}

export type RevenueDay = { date: string; transactions: number; gross: number; discounts: number; taxable: number; cgst: number; sgst: number; net: number }
export function useRevenueReport(period: ReportPeriod, custom: DateRange) {
  const { gym } = useGym(); const range = useRange(period, custom)
  const loader = useCallback(async (): Promise<RevenueDay[]> => {
    if (!gym || !supabase) return [] as RevenueDay[]
    const { data, error } = await (supabase as any).from('payments').select('created_at,amount,discount_amount,taxable_amount,cgst_amount,sgst_amount,total_amount').eq('gym_id', gym.gym_id).eq('status', 'captured').gte('created_at', `${range.from}T00:00:00+05:30`).lte('created_at', `${range.to}T23:59:59+05:30`)
    if (error) throw error
    const grouped = new Map<string, RevenueDay>()
    for (const row of data ?? []) { const date = istDate(row.created_at); const item = grouped.get(date) ?? { date, transactions: 0, gross: 0, discounts: 0, taxable: 0, cgst: 0, sgst: 0, net: 0 }; item.transactions++; item.gross += Number(row.amount); item.discounts += Number(row.discount_amount); item.taxable += Number(row.taxable_amount); item.cgst += Number(row.cgst_amount); item.sgst += Number(row.sgst_amount); item.net += Number(row.total_amount); grouped.set(date, item) }
    return [...grouped.values()].sort((a, b) => b.date.localeCompare(a.date))
  }, [gym, range.from, range.to])
  const state = useReportState<RevenueDay[]>(loader, [])
  const summary = useMemo(() => state.data.reduce((s, row) => ({ revenue: s.revenue + row.net, transactions: s.transactions + row.transactions, gst: s.gst + row.cgst + row.sgst }), { revenue: 0, transactions: 0, gst: 0 }), [state.data])
  const chart = useMemo(() => {
    const daily = [...state.data].reverse().map(row => ({ date: row.date, revenue: row.net }))
    if (daysBetween(range.from, range.to) <= 90) return daily
    const weeks = new Map<string, number>(); daily.forEach((row, index) => { const key = daily[Math.floor(index / 7) * 7]?.date ?? row.date; weeks.set(key, (weeks.get(key) ?? 0) + row.revenue) }); return [...weeks].map(([date, revenue]) => ({ date, revenue }))
  }, [state.data, range.from, range.to])
  return { ...state, range, rows: state.data, chart, summary: { ...summary, average: summary.transactions ? summary.revenue / summary.transactions : 0 } }
}

export type MembershipReportRow = { id: string; member: string; plan: string; planId: string; status: string; startDate: string; endDate: string; daysRemaining: number; amountPaid: number; createdAt: string; cancelledAt: string | null }
export function useMembershipReport(period: ReportPeriod, custom: DateRange) {
  const { gym } = useGym(); const range = useRange(period, custom)
  const loader = useCallback(async (): Promise<MembershipReportRow[]> => {
    if (!gym || !supabase) return [] as MembershipReportRow[]
    const { data, error } = await (supabase as any).from('memberships').select('id,status,start_date,end_date,created_at,cancelled_at,plan:membership_plans!memberships_plan_id_fkey(id,name),member:gym_members!memberships_member_id_fkey(profiles(full_name)),payment:payments!memberships_payment_id_fkey(total_amount)').eq('gym_id', gym.gym_id).order('start_date', { ascending: false })
    if (error) throw error
    return (data ?? []).map((row: any) => { const plan = Array.isArray(row.plan) ? row.plan[0] : row.plan; const member = Array.isArray(row.member) ? row.member[0] : row.member; const payment = Array.isArray(row.payment) ? row.payment[0] : row.payment; return { id: row.id, member: member?.profiles?.full_name ?? 'Unknown member', plan: plan?.name ?? 'Unknown plan', planId: plan?.id ?? '', status: row.status, startDate: row.start_date, endDate: row.end_date, daysRemaining: Math.max(0, daysBetween(toDateOnly(), row.end_date) + 1), amountPaid: Number(payment?.total_amount ?? 0), createdAt: row.created_at, cancelledAt: row.cancelled_at } })
  }, [gym])
  const state = useReportState<MembershipReportRow[]>(loader, []); const month = toDateOnly().slice(0, 7)
  const summary = useMemo(() => ({ active: state.data.filter(r => r.status === 'active').length, scheduled: state.data.filter(r => r.status === 'scheduled').length, frozen: state.data.filter(r => r.status === 'frozen').length, expired: state.data.filter(r => r.status === 'expired' && r.endDate.startsWith(month)).length, cancelled: state.data.filter(r => r.status === 'cancelled' && r.cancelledAt?.startsWith(month)).length, newCount: state.data.filter(r => r.createdAt.startsWith(month)).length }), [state.data, month])
  const chart = useMemo(() => Array.from({ length: 6 }, (_, index) => { const date = new Date(); date.setMonth(date.getMonth() - 5 + index); const key = date.toISOString().slice(0, 7); const rows = state.data.filter(row => row.startDate.slice(0, 7) === key); return { month: date.toLocaleDateString('en-IN', { month: 'short' }), active: rows.filter(r => r.status === 'active').length, scheduled: rows.filter(r => r.status === 'scheduled').length, frozen: rows.filter(r => r.status === 'frozen').length, expired: rows.filter(r => r.status === 'expired').length, cancelled: rows.filter(r => r.status === 'cancelled').length } }), [state.data])
  return { ...state, range, rows: state.data.filter(row => row.startDate >= range.from && row.startDate <= range.to), summary, chart }
}

export type AttendanceDay = { date: string; day: string; checkIns: number; uniqueMembers: number; peakHour: string }
export type RawAttendance = { date: string; member: string; method: string; checkIn: string; checkOut: string }
type AttendanceReportSource = { member_id: string; check_in_at: string; check_out_at: string | null; method: string | null; member: any }
export function useAttendanceReport(period: ReportPeriod, custom: DateRange) {
  const { gym } = useGym(); const range = useRange(period, custom)
  const loader = useCallback(async (): Promise<AttendanceReportSource[]> => {
    if (!gym || !supabase) return []
    const { data, error } = await (supabase as any).from('attendance').select('id,member_id,check_in_at,check_out_at,method,member:gym_members!attendance_member_id_fkey(profiles(full_name))').eq('gym_id', gym.gym_id).gte('check_in_at', `${range.from}T00:00:00+05:30`).lte('check_in_at', `${range.to}T23:59:59+05:30`).order('check_in_at')
    if (error) throw error; return (data ?? []) as AttendanceReportSource[]
  }, [gym, range.from, range.to])
  const state = useReportState<AttendanceReportSource[]>(loader, [])
  const derived = useMemo(() => {
    const days = new Map<string, { members: Set<string>; hours: Map<number, number>; total: number }>(); const memberCounts = new Map<string, number>(); const hourly = Array.from({ length: 17 }, (_, i) => ({ hour: i + 6, count: 0 }))
    const raw: RawAttendance[] = state.data.map(row => { const date = istDate(row.check_in_at); const hour = istHour(row.check_in_at); const item = days.get(date) ?? { members: new Set<string>(), hours: new Map<number, number>(), total: 0 }; item.total++; item.members.add(row.member_id); item.hours.set(hour, (item.hours.get(hour) ?? 0) + 1); days.set(date, item); if (hour >= 6 && hour <= 22) hourly[hour - 6].count++; const member = Array.isArray(row.member) ? row.member[0] : row.member; const name = member?.profiles?.full_name ?? 'Unknown member'; memberCounts.set(name, (memberCounts.get(name) ?? 0) + 1); return { date, member: name, method: row.method ?? 'qr', checkIn: row.check_in_at, checkOut: row.check_out_at ?? '' } })
    const rows: AttendanceDay[] = [...days].map(([date, item]) => { const peak = [...item.hours].sort((a, b) => b[1] - a[1])[0]?.[0]; return { date, day: new Date(`${date}T00:00:00+05:30`).toLocaleDateString('en-IN', { weekday: 'long' }), checkIns: item.total, uniqueMembers: item.members.size, peakHour: peak === undefined ? '—' : `${String(peak).padStart(2, '0')}:00` } }).sort((a, b) => b.date.localeCompare(a.date))
    const total = state.data.length; const unique = new Set(state.data.map(row => row.member_id)).size; const peak = [...hourly].sort((a, b) => b.count - a.count)[0]; const active = [...memberCounts].sort((a, b) => b[1] - a[1])[0]
    return { rows, raw, hourly, summary: { total, unique, average: total / Math.max(1, daysBetween(range.from, range.to) + 1), peakHour: peak?.count ? `${String(peak.hour).padStart(2, '0')}:00` : '—', mostActive: active?.[0] ?? '—' } }
  }, [state.data, range.from, range.to])
  return { ...state, range, ...derived }
}

export type PaymentReportRow = { id: string; date: string; member: string; description: string; subtotal: number; discount: number; gst: number; total: number; status: string; razorpayId: string }
export function usePaymentsReport(period: ReportPeriod, custom: DateRange) {
  const { gym } = useGym(); const range = useRange(period, custom)
  const loader = useCallback(async (): Promise<PaymentReportRow[]> => {
    if (!gym || !supabase) return [] as PaymentReportRow[]
    const { data, error } = await (supabase as any).from('payments').select('id,created_at,amount,discount_amount,cgst_amount,sgst_amount,total_amount,status,description,razorpay_payment_id,member:gym_members!payments_member_id_fkey(profiles(full_name))').eq('gym_id', gym.gym_id).gte('created_at', `${range.from}T00:00:00+05:30`).lte('created_at', `${range.to}T23:59:59+05:30`).order('created_at', { ascending: false })
    if (error) throw error; return (data ?? []).map((row: any) => { const member = Array.isArray(row.member) ? row.member[0] : row.member; return { id: row.id, date: row.created_at, member: member?.profiles?.full_name ?? 'Unknown member', description: row.description ?? 'Membership', subtotal: Number(row.amount), discount: Number(row.discount_amount), gst: Number(row.cgst_amount) + Number(row.sgst_amount), total: Number(row.total_amount), status: row.status, razorpayId: row.razorpay_payment_id ?? '' } })
  }, [gym, range.from, range.to])
  const state = useReportState<PaymentReportRow[]>(loader, [])
  const summary = useMemo(() => ({ collected: state.data.filter(r => r.status === 'captured').reduce((sum, r) => sum + r.total, 0), successful: state.data.filter(r => r.status === 'captured').length, failed: state.data.filter(r => r.status === 'failed').length, pending: state.data.filter(r => r.status === 'created').length, discounts: state.data.filter(r => r.status === 'captured').reduce((sum, r) => sum + r.discount, 0) }), [state.data])
  return { ...state, range, rows: state.data, summary }
}
