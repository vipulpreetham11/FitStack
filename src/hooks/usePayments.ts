import { useCallback, useEffect, useMemo, useState } from 'react'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { useGym } from '@/hooks/useGym'
import { toDateOnly } from '@/lib/membership'
import { parseCheckoutOrderResult, parsePaymentResult, type CheckoutOrderResult } from '@/lib/payment'
import type { Database } from '@/types/database'

type PaymentRow = Database['public']['Tables']['payments']['Row']
type SafePaymentRow = Omit<PaymentRow, 'razorpay_signature' | 'metadata'>
export type Payment = SafePaymentRow & {
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
export type CheckoutMembership = { id: string; status: 'active' | 'frozen' | 'scheduled' }

async function functionFailure(error: unknown) {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = await error.context.clone().json()
      return { status: error.context.status, message: String(body.error ?? body.message ?? error.message) }
    } catch { return { status: error.context.status, message: error.message } }
  }
  return { status: null, message: error instanceof Error ? error.message : 'Payment request failed' }
}

export function usePayments() {
  const { gym, gymMember } = useGym()
  const ownPaymentsOnly = gym?.role === 'member' || gym?.role === 'trainer'
  const gymMemberId = gymMember?.id ?? null
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!gym || !supabase || (ownPaymentsOnly && !gymMemberId)) { setPayments([]); setLoading(false); return }
    setLoading(true); setError(null)
    let query = (supabase as any).from('payments').select(`id,gym_id,member_id,plan_id,requested_start_date,amount,discount_amount,taxable_amount,gst_rate,cgst_amount,sgst_amount,total_amount,currency,razorpay_order_id,razorpay_payment_id,status,promo_code_id,description,created_by,created_at,updated_at,member:gym_members!payments_member_id_fkey(id,profiles(full_name,phone,email)),invoice:invoices!invoices_payment_id_fkey(id,invoice_number)`).eq('gym_id', gym.gym_id)
    if (ownPaymentsOnly) query = query.eq('member_id', gymMemberId)
    const { data, error: queryError } = await query.order('created_at', { ascending: false })
    if (queryError) setError(queryError.message)
    else setPayments((data ?? []).map((row: any) => ({
      ...row,
      member: Array.isArray(row.member) ? row.member[0] ?? null : row.member ?? null,
      invoice: Array.isArray(row.invoice) ? row.invoice[0] ?? null : row.invoice ?? null,
    })) as Payment[])
    setLoading(false)
  }, [gym, gymMemberId, ownPaymentsOnly])

  useEffect(() => { void refresh() }, [refresh])

  const simulateOrder = useCallback(async (input: OrderInput, preview: boolean): Promise<OrderResult> => {
    if (!gym || !supabase) throw new Error('Supabase is not configured')
    const { data, error: rpcError } = await supabase.rpc('simulate_payment_checkout', {
      p_gym_id: gym.gym_id,
      p_member_id: input.memberId,
      p_plan_id: input.planId,
      p_start_date: input.startDate,
      p_promo_code: input.promoCode?.trim().toUpperCase() || null,
      p_preview: preview,
    })
    if (rpcError) throw rpcError
    return parsePaymentResult<OrderResult>(data)
  }, [gym])

  const invokeOrder = useCallback(async (input: OrderInput): Promise<CheckoutOrderResult> => {
    if (!gym || !supabase) throw new Error('Supabase is not configured')
    const { data, error: invokeError } = await supabase.functions.invoke('create-razorpay-order', { body: {
      gym_id: gym.gym_id, member_id: input.memberId, plan_id: input.planId, start_date: input.startDate,
      promo_code: input.promoCode?.trim().toUpperCase() || null,
    } })
    if (invokeError) {
      const failure = await functionFailure(invokeError)
      if (failure.status === 400 && /Razorpay credentials are not configured/i.test(failure.message)) {
        return parseCheckoutOrderResult(await simulateOrder(input, false))
      }
      throw new Error(failure.message)
    }
    if (data?.error) throw new Error(String(data.error))
    return parseCheckoutOrderResult(data)
  }, [gym, simulateOrder])

  const createOrder = useCallback(async (input: OrderInput) => {
    const result = await invokeOrder(input)
    await refresh()
    return result
  }, [invokeOrder, refresh])

  const previewOrder = useCallback(async (input: OrderInput) => {
    const result = await simulateOrder(input, true)
    return { ...result, simulated: false }
  }, [simulateOrder])

  const reconcileCompletedCheckout = useCallback(async (input: OrderInput, attemptedAfter: string): Promise<CheckoutMembership | null> => {
    if (!gym || !supabase) return null
    const { data, error: queryError } = await supabase
      .from('memberships')
      .select('id, status')
      .eq('gym_id', gym.gym_id)
      .eq('member_id', input.memberId)
      .eq('plan_id', input.planId)
      .in('status', ['active', 'frozen', 'scheduled'])
      .gte('created_at', attemptedAfter)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (queryError || !data) return null
    return data as CheckoutMembership
  }, [gym])

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

  return { payments, loading, error, refresh, previewOrder, createOrder, reconcileCompletedCheckout, handlePaymentSuccess, handleFreeCheckout, stats }
}
