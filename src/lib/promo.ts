import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/types/database'

type PromoCode = Database['public']['Tables']['promo_codes']['Row']

export interface PromoValidationResult {
  valid: boolean
  error?: string
  discountAmount: number
  promoCodeId: string
}

function invalid(error: string): PromoValidationResult {
  return { valid: false, error, discountAmount: 0, promoCodeId: '' }
}

export function applicablePlanIds(value: Json | null): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

export function calculatePromoDiscount(promo: Pick<PromoCode, 'discount_type' | 'discount_value' | 'max_discount_amount'>, planPrice: number) {
  if (!Number.isFinite(planPrice) || planPrice < 0) throw new RangeError('Invalid plan price')
  const raw = promo.discount_type === 'percentage'
    ? planPrice * (Number(promo.discount_value) / 100)
    : Number(promo.discount_value)
  const capped = promo.max_discount_amount === null ? raw : Math.min(raw, Number(promo.max_discount_amount))
  return Math.round(Math.min(planPrice, Math.max(0, capped)) * 100) / 100
}

export async function validatePromoCode(
  code: string,
  planId: string,
  planPrice: number,
  gymId: string,
  supabase: SupabaseClient,
): Promise<PromoValidationResult> {
  const normalized = code.trim().toUpperCase()
  const { data, error } = await supabase
    .from('promo_codes')
    .select('*')
    .eq('gym_id', gymId)
    .ilike('code', normalized)
    .eq('is_active', true)
    .maybeSingle()
  if (error || !data) return invalid('Invalid promo code')

  const promo = data as PromoCode
  const now = Date.now()
  if (new Date(promo.valid_from).getTime() > now) return invalid('This promo is not active yet')
  if (promo.valid_until && new Date(promo.valid_until).getTime() < now) return invalid('This promo has expired')
  if (promo.max_uses !== null && promo.used_count >= promo.max_uses) return invalid('This promo has been fully redeemed')
  const planIds = applicablePlanIds(promo.applicable_plan_ids)
  if (promo.applicable_plan_ids !== null && !planIds.includes(planId)) return invalid('This promo is not valid for the selected plan')

  return { valid: true, discountAmount: calculatePromoDiscount(promo, planPrice), promoCodeId: promo.id }
}
