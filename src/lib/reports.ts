import { toDateOnly } from './membership'

export type ReportPeriod = 'month' | 'last_month' | 'quarter' | 'year' | 'custom'
export type DateRange = { from: string; to: string }

export function reportRange(period: ReportPeriod, custom?: DateRange): DateRange {
  const today = toDateOnly()
  const year = Number(today.slice(0, 4)); const month = Number(today.slice(5, 7))
  if (period === 'custom' && custom?.from && custom?.to) return custom
  if (period === 'month') return { from: `${today.slice(0, 7)}-01`, to: today }
  if (period === 'last_month') {
    const first = new Date(Date.UTC(year, month - 2, 1)); const last = new Date(Date.UTC(year, month - 1, 0))
    return { from: first.toISOString().slice(0, 10), to: last.toISOString().slice(0, 10) }
  }
  if (period === 'quarter') return { from: `${year}-${String(Math.floor((month - 1) / 3) * 3 + 1).padStart(2, '0')}-01`, to: today }
  return { from: `${year}-01-01`, to: today }
}
