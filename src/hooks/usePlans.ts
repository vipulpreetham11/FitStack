import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useGym } from '@/hooks/useGym'
import type { Database } from '@/types/database'

export type MembershipPlan = Database['public']['Tables']['membership_plans']['Row']
export type PlanInput = Omit<Database['public']['Tables']['membership_plans']['Insert'], 'gym_id' | 'created_by'>

export function usePlans() {
  const { gym, gymMember } = useGym()
  const [plans, setPlans] = useState<MembershipPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!gym || !supabase) {
      setPlans([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    const { data, error: queryError } = await supabase
      .from('membership_plans')
      .select('*')
      .eq('gym_id', gym.gym_id)
      .order('sort_order')
      .order('created_at')
    if (queryError) {
      setError(queryError.message)
      setLoading(false)
      return
    }
    setPlans(data)
    setLoading(false)
  }, [gym])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const createPlan = useCallback(async (input: PlanInput) => {
    if (!gym || !supabase) throw new Error('Supabase is not configured')
    const { error: mutationError } = await supabase.from('membership_plans').insert({
      ...input,
      gym_id: gym.gym_id,
      created_by: gymMember?.id ?? null,
    })
    if (mutationError) throw mutationError
    await refresh()
  }, [gym, gymMember?.id, refresh])

  const updatePlan = useCallback(async (id: string, input: Partial<PlanInput>) => {
    if (!gym || !supabase) throw new Error('Supabase is not configured')
    const { error: mutationError } = await supabase
      .from('membership_plans')
      .update(input)
      .eq('id', id)
      .eq('gym_id', gym.gym_id)
    if (mutationError) throw mutationError
    await refresh()
  }, [gym, refresh])

  const togglePlanActive = useCallback(async (id: string, isActive: boolean) => {
    await updatePlan(id, { is_active: isActive })
  }, [updatePlan])

  const getPlan = useCallback(async (id: string) => {
    if (!gym || !supabase) throw new Error('Supabase is not configured')
    const { data, error: queryError } = await supabase
      .from('membership_plans')
      .select('*')
      .eq('id', id)
      .eq('gym_id', gym.gym_id)
      .single()
    if (queryError) throw queryError
    return data
  }, [gym])

  const activePlans = useMemo(
    () => plans.filter(plan => plan.is_active).sort((a, b) => a.sort_order - b.sort_order),
    [plans],
  )

  return { plans, activePlans, loading, error, refresh, createPlan, updatePlan, togglePlanActive, getPlan }
}
