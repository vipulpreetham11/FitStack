import { useCallback, useEffect, useMemo, useState } from 'react'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { useGym } from '@/hooks/useGym'
import { toDateOnly } from '@/lib/membership'
import type { Database } from '@/types/database'

type PaymentRow = Database['public']['Tables']['payments']['Row']
export type Payment = PaymentRow & {
  member: { id: string; profiles: { full_name: string; phone: string | null; email: string | null } | null } | null
  invoice: { id: string; invoice_number: string } | null
}

export type PricingBreakdown = {
  amount: number
  discountAmount: number
  taxableAmount: number
  gstRate: number
  cgstAmount: number
  sgstAmount: number
  totalAmount: number
  totalPaise: number
  promoCodeId: string | null
  promoCode: string | null
}

export type OrderResult = PricingBreakdown & {
  orderId: string | null
  paymentId: string | null
  razorpayKeyId: string | null
  currency: string
  simulated: boolean
  captured: boolean
  invoiceId?: string | null
  membershipId?: string | null
}

type OrderInput = { planId: string; memberId: string; startDate: string; promoCode?: string }

async function functionMessage(error: unknown) {
  if (error instanceof FunctionsHttpError) {
    try { const body = await error.context.json(); return String(body.error ?? body.message ?? error.message) } catch { return error.message }
  }
  return error instanceof Error ? error.message : 'Payment request failed'
}

export function usePayments() {
  const { gym } = useGym()
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!gym || !supabase) { setPayments([]); setLoading(false); return }
    setLoading(true); setError(null)
    const { data, error: queryError } = await (supabase as any).from('payments').select(`*, member:gym_members!payments_member_id_fkey(id,profiles(full_name,phone,email)), invoice:invoices!invoices_payment_id_fkey(id,invoice_number)`).eq('gym_id', gym.gym_id).order('created_at', { ascending: false })
    if (queryError) setError(queryError.message)
    else setPayments((data ?? []).map((row: any) => ({
      ...row,
      member: Array.isArray(row.member) ? row.member[0] ?? null : row.member ?? null,
      invoice: Array.isArray(row.invoice) ? row.invoice[0] ?? null : row.invoice ?? null,
    })) as Payment[])
    setLoading(false)
  }, [gym])

  useEffect(() => { void refresh() }, [refresh])

  const invokeOrder = useCallback(async (input: OrderInput, preview: boolean): Promise<OrderResult> => {
    if (!gym || !supabase) throw new Error('Supabase is not configured')
    const { data, error: invokeError } = await supabase.functions.invoke('create-razorpay-order', { body: {
      gym_id: gym.gym_id, member_id: input.memberId, plan_id: input.planId, start_date: input.startDate,
      promo_code: input.promoCode?.trim().toUpperCase() || null, preview,
    } })
    if (invokeError) throw new Error(await functionMessage(invokeError))
    if (data?.error) throw new Error(String(data.error))
    return data as OrderResult
  }, [gym])

  const createOrder = useCallback(async (input: OrderInput) => {
    const result = await invokeOrder(input, false)
    await refresh()
    return result
  }, [invokeOrder, refresh])

  const previewOrder = useCallback((input: OrderInput) => invokeOrder(input, true), [invokeOrder])

  const handlePaymentSuccess = useCallback(async (paymentId: string) => {
    if (!gym || !supabase) throw new Error('Supabase is not configured')
    for (let attempt = 0; attempt < 20; attempt++) {
      const { data, error: queryError } = await supabase.from('payments').select('status').eq('id', paymentId).eq('gym_id', gym.gym_id).single()
      if (queryError) throw queryError
      if (data.status === 'captured') { await refresh(); return }
      if (data.status === 'failed') throw new Error('Payment failed. Please try again.')
      await new Promise(resolve => window.setTimeout(resolve, 1000))
    }
    throw new Error('Payment is still being confirmed. Check payment history in a moment.')
  }, [gym, refresh])

  const handleFreeCheckout = useCallback(async (input: OrderInput) => {
    const result = await createOrder(input)
    if (!result.captured) throw new Error('Free checkout was not completed')
    return result
  }, [createOrder])

  const stats = useMemo(() => {
    const today = toDateOnly(); const month = today.slice(0, 7)
    return {
      totalThisMonth: payments.filter(item => item.status === 'captured' && item.created_at.slice(0, 7) === month).reduce((sum, item) => sum + Number(item.total_amount), 0),
      countToday: payments.filter(item => toDateOnly(new Date(item.created_at)) === today).length,
      pending: payments.filter(item => item.status === 'created').length,
      failedThisMonth: payments.filter(item => item.status === 'failed' && item.created_at.slice(0, 7) === month).length,
    }
  }, [payments])

  return { payments, loading, error, refresh, previewOrder, createOrder, handlePaymentSuccess, handleFreeCheckout, stats }
}
