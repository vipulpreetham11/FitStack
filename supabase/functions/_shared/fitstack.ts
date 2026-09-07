import { createClient } from 'npm:@supabase/supabase-js@2.109.0'
import { corsHeaders } from 'npm:@supabase/supabase-js@2.109.0/cors'

export { corsHeaders }
export type JsonRecord = Record<string, unknown>
export type AdminClient = ReturnType<typeof createClient>

export class HttpError extends Error {
  constructor(message: string, readonly status = 400) { super(message) }
}

export function json(body: unknown, status = 200, cors = true) {
  return Response.json(body, { status, headers: cors ? corsHeaders : undefined })
}

export function envKey(jsonName: string, singleName: string, legacyName: string) {
  const grouped = Deno.env.get(jsonName)
  if (grouped) {
    const parsed = JSON.parse(grouped) as Record<string, string>
    if (parsed.default) return parsed.default
  }
  return Deno.env.get(singleName) ?? Deno.env.get(legacyName) ?? ''
}

export function todayIndia() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const part = (type: string) => parts.find(item => item.type === type)?.value
  return `${part('year')}-${part('month')}-${part('day')}`
}

export function validDateOnly(value: unknown, label = 'date') {
  const text = String(value ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new HttpError(`Choose a valid ${label}`)
  const parsed = new Date(`${text}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== text) throw new HttpError(`Choose a valid ${label}`)
  return text
}

export function money(value: number) { return Math.round((value + Number.EPSILON) * 100) / 100 }

export async function authenticatedAdmin(req: Request) {
  const authorization = req.headers.get('Authorization')
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : ''
  if (!token) throw new HttpError('Sign in required', 401)
  const url = Deno.env.get('SUPABASE_URL') ?? ''
  const publishableKey = envKey('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_ANON_KEY')
  const secretKey = envKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !publishableKey || !secretKey) throw new HttpError('Function is not configured', 500)
  const authClient = createClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: { user }, error } = await authClient.auth.getUser(token)
  if (error || !user) throw new HttpError('Sign in required', 401)
  return { user, admin: createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } }) }
}

export function promoPlanIds(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

export async function serverPromo(admin: AdminClient, gymId: string, code: unknown, planId: string, planPrice: number) {
  const normalized = String(code ?? '').trim().toUpperCase()
  if (!normalized) return { id: null as string | null, code: null as string | null, discount: 0 }
  const { data: promo, error } = await admin.from('promo_codes').select('*').eq('gym_id', gymId).ilike('code', normalized).eq('is_active', true).maybeSingle()
  if (error) throw error
  if (!promo) throw new HttpError('Invalid promo code')
  const now = Date.now()
  if (new Date(promo.valid_from).getTime() > now) throw new HttpError('This promo is not active yet')
  if (promo.valid_until && new Date(promo.valid_until).getTime() < now) throw new HttpError('This promo has expired')
  if (promo.max_uses !== null && promo.used_count >= promo.max_uses) throw new HttpError('This promo has been fully redeemed')
  if (promo.applicable_plan_ids !== null && !promoPlanIds(promo.applicable_plan_ids).includes(planId)) throw new HttpError('This promo is not valid for the selected plan')
  const raw = promo.discount_type === 'percentage' ? planPrice * Number(promo.discount_value) / 100 : Number(promo.discount_value)
  const capped = promo.max_discount_amount === null ? raw : Math.min(raw, Number(promo.max_discount_amount))
  return { id: promo.id as string, code: promo.code as string, discount: money(Math.min(planPrice, Math.max(0, capped))) }
}
