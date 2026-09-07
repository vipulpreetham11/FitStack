import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useGym } from '@/hooks/useGym'
import { validatePromoCode, type PromoValidationResult } from '@/lib/promo'
import type { Database } from '@/types/database'

export type PromoCode = Database['public']['Tables']['promo_codes']['Row']
export type PromoInput = Omit<Database['public']['Tables']['promo_codes']['Insert'], 'gym_id' | 'created_by' | 'used_count'>

export function usePromos() {
  const { gym, gymMember } = useGym()
  const [promos, setPromos] = useState<PromoCode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!gym || !supabase) { setPromos([]); setLoading(false); return }
    setLoading(true)
    setError(null)
    const { data, error: queryError } = await supabase.from('promo_codes').select('*').eq('gym_id', gym.gym_id).order('created_at', { ascending: false })
    if (queryError) setError(queryError.message)
    else setPromos(data)
    setLoading(false)
  }, [gym])

  useEffect(() => { void refresh() }, [refresh])

  const createPromo = useCallback(async (input: PromoInput) => {
    if (!gym || !supabase) throw new Error('Supabase is not configured')
    const { error: mutationError } = await supabase.from('promo_codes').insert({ ...input, gym_id: gym.gym_id, created_by: gymMember?.id ?? null })
    if (mutationError) throw mutationError
    await refresh()
  }, [gym, gymMember?.id, refresh])

  const updatePromo = useCallback(async (id: string, input: Partial<PromoInput>) => {
    if (!gym || !supabase) throw new Error('Supabase is not configured')
    const { error: mutationError } = await supabase.from('promo_codes').update(input).eq('id', id).eq('gym_id', gym.gym_id)
    if (mutationError) throw mutationError
    await refresh()
  }, [gym, refresh])

  const getPromo = useCallback(async (id: string) => {
    if (!gym || !supabase) throw new Error('Supabase is not configured')
    const { data, error: queryError } = await supabase.from('promo_codes').select('*').eq('id', id).eq('gym_id', gym.gym_id).single()
    if (queryError) throw queryError
    return data
  }, [gym])

  const validateCode = useCallback(async (code: string, planId: string, planPrice: number): Promise<PromoValidationResult> => {
    if (!gym || !supabase) return { valid: false, error: 'Supabase is not configured', discountAmount: 0, promoCodeId: '' }
    return validatePromoCode(code, planId, planPrice, gym.gym_id, supabase)
  }, [gym])

  return {
    promos, loading, error, refresh, createPromo, updatePromo, getPromo,
    togglePromoActive: (id: string, isActive: boolean) => updatePromo(id, { is_active: isActive }), validateCode,
  }
}
