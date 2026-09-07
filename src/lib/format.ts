const IST = 'Asia/Kolkata'
function validDate(value: Date | string | number) {
  const date = value instanceof Date ? value : new Date(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value + 'T00:00:00+05:30' : value)
  if (Number.isNaN(date.getTime())) throw new RangeError('Invalid date')
  return date
}
export function formatDate(value: Date | string | number): string {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: IST, day: '2-digit', month: 'short', year: 'numeric' }).formatToParts(validDate(value))
  const get = (type: string) => parts.find(p => p.type === type)?.value
  return [get('day'), get('month')?.replace('Sept', 'Sep'), get('year')].join(' ')
}
export function formatDateTime(value: Date | string | number): string {
  const date = validDate(value)
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: IST, hour: '2-digit', minute: '2-digit', hour12: true }).formatToParts(date)
  const get = (type: string) => parts.find(p => p.type === type)?.value
  return formatDate(date) + ', ' + get('hour') + ':' + get('minute') + ' ' + get('dayPeriod')
}
export function formatCurrency(amount: number): string {
  if (!Number.isFinite(amount)) throw new RangeError('Invalid amount')
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(amount)
}
export function parsePhone(input: string): string {
  let digits = input.replace(/[\s()+-]/g, '')
  if (digits.startsWith('0091') && digits.length === 14) digits = digits.slice(4)
  if (digits.startsWith('91') && digits.length === 12) digits = digits.slice(2)
  if (!/^[6-9]\d{9}$/.test(digits)) throw new RangeError('Enter a valid 10-digit Indian mobile number')
  return digits
}
export const normalizePhone = (input: string) => '+91' + parsePhone(input)
export function formatPhone(input: string): string {
  const digits = parsePhone(input)
  return '+91 ' + digits.slice(0, 5) + ' ' + digits.slice(5)
}
