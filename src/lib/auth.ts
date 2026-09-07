import { z } from 'zod'
import type { Role } from '@/types'
export type AuthMode = 'email' | 'phone'
export const AUTH_MODE: AuthMode = import.meta.env.VITE_AUTH_MODE === 'phone' ? 'phone' : 'email'
export function normalizeIdentity(input: string, mode: AuthMode): string {
  if (mode === 'email') return z.email('Enter a valid email address.').parse(input.trim().toLowerCase())
  let digits = input.replace(/[\s()+-]/g, '')
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2)
  return '+91' + z.string().regex(/^[6-9]\d{9}$/, 'Enter a 10-digit Indian mobile number starting with 6–9.').parse(digits)
}
export function otpRequest(identity: string, mode: AuthMode) {
  const value = normalizeIdentity(identity, mode)
  return mode === 'email' ? { email: value } : { phone: value }
}
export function otpVerification(identity: string, token: string, mode: AuthMode) {
  z.string().regex(/^\d{6}$/, 'Enter all six digits.').parse(token)
  const value = normalizeIdentity(identity, mode)
  return mode === 'email' ? { email: value, token, type: 'email' as const } : { phone: value, token, type: 'sms' as const }
}
export function isProfileComplete(profile: { full_name: string } | null): boolean {
  return !!profile?.full_name.trim() && profile.full_name.trim().toLowerCase() !== 'new user'
}
export function dashboardPath(role: Role | null, superAdmin = false): string {
  return superAdmin ? '/super-admin' : role === null ? '/no-gym' : ['owner', 'admin', 'receptionist'].includes(role) ? '/admin' : '/member'
}
// Never redirect to user-provided external URLs, login loops, or protocol-relative paths.
export function safeReturnPath(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\/(?:admin|member|super-admin|join)(?:\/|\?|$)/.test(value) || /[\\\r\n]/.test(value)) return null
  return value
}
export function authError(error: unknown): string {
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? 'Check your details.'
  const e = error as { code?: string; status?: number; message?: string }
  if (e?.status === 429 || /rate_limit|over_.*limit/.test(e?.code ?? '')) return 'Too many requests. Please wait a minute before trying again.'
  if (/otp_expired|otp_disabled/.test(e?.code ?? '') || /expired|invalid.*token/i.test(e?.message ?? '')) return 'That code is invalid or expired. Check the code or request a new one.'
  if (/fetch|network/i.test(e?.message ?? '')) return 'Unable to connect. Check your connection and try again.'
  if (/PGRST202|42883/.test(e?.code ?? '')) return 'Authentication setup is incomplete. Apply the Module 3 SQL update, then retry.'
  if (/Gym access is inactive|Gym not found|Complete your profile|Sign in required|verified identity/i.test(e?.message ?? '')) return e.message!
  if (e?.code === 'email_address_not_authorized') return 'This email cannot receive messages from the current development email provider. Check the Supabase email settings.'
  return 'We could not complete that request. Please retry or contact your gym.'
}
const optionalText = z.string().trim().max(120, 'Use 120 characters or fewer.')
export const onboardingSchema = z.object({
  full_name: z.string().trim().min(2, 'Enter your full name.').max(120).refine(v => v.toLowerCase() !== 'new user', 'Enter your own name.'),
  email: z.union([z.literal(''), z.email('Enter a valid email address.')]),
  date_of_birth: z.string().refine(v => !v || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0,10) === v && v <= new Date().toISOString().slice(0,10) && v >= '1900-01-01'), 'Enter a valid date of birth in the past.'),
  gender: z.enum(['', 'male', 'female', 'other']),
  emergency_contact_name: optionalText,
  emergency_contact_phone: z.string().refine(v => !v || /^([+]91)?[6-9]\d{9}$/.test(v), 'Enter a valid Indian mobile number.'),
})
export type OnboardingValues = z.infer<typeof onboardingSchema>
