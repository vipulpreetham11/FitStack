import type { Json } from '@/types/database'

export type MembershipStatus = 'active' | 'frozen' | 'scheduled' | 'expired' | 'cancelled'
export type DurationType = 'days' | 'months' | 'years'

const DAY_MS = 86_400_000

function parseDateOnly(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) throw new RangeError('Invalid date')
  return new Date(Date.UTC(year, month - 1, day))
}

export function toDateOnly(value = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value)
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value
  return `${part('year')}-${part('month')}-${part('day')}`
}

export function addDays(value: string, days: number) {
  const date = parseDateOnly(value)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function calculateMembershipEndDate(startDate: string, durationType: DurationType, durationValue: number) {
  if (!Number.isInteger(durationValue) || durationValue < 1) throw new RangeError('Invalid duration')
  if (durationType === 'days') return addDays(startDate, durationValue - 1)

  const start = parseDateOnly(startDate)
  const targetYear = start.getUTCFullYear() + (durationType === 'years' ? durationValue : 0)
  const targetMonth = start.getUTCMonth() + (durationType === 'months' ? durationValue : 0)
  const day = start.getUTCDate()
  const target = new Date(Date.UTC(targetYear, targetMonth, 1))
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(day, lastDay))
  target.setUTCDate(target.getUTCDate() - 1)
  return target.toISOString().slice(0, 10)
}

export function daysBetween(startDate: string, endDate: string) {
  return Math.max(0, Math.floor((parseDateOnly(endDate).getTime() - parseDateOnly(startDate).getTime()) / DAY_MS))
}

export function daysRemaining(endDate: string, today = toDateOnly()) {
  return Math.max(0, daysBetween(today, endDate) + 1)
}

export function membershipProgress(startDate: string, endDate: string, today = toDateOnly()) {
  const total = Math.max(1, daysBetween(startDate, endDate) + 1)
  const used = Math.min(total, Math.max(0, daysBetween(startDate, today) + 1))
  return Math.round((used / total) * 100)
}

export function durationLabel(type: string, value: number) {
  const singular = type === 'days' ? 'Day' : type === 'months' ? 'Month' : 'Year'
  return `${value} ${singular}${value === 1 ? '' : 's'}`
}

export function jsonStrings(value: Json): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

export const membershipStatusClasses: Record<MembershipStatus, string> = {
  active: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300',
  scheduled: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/60 dark:text-sky-300',
  frozen: 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-300',
  expired: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/60 dark:text-red-300',
  cancelled: 'border-muted bg-muted text-muted-foreground',
}
