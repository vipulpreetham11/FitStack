import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, CreditCard, RefreshCw, ShieldCheck, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useGym } from '@/hooks/useGym'
import { usePayments, type OrderResult, type PricingBreakdown } from '@/hooks/usePayments'
import { usePlans, type MembershipPlan } from '@/hooks/usePlans'
import { calculateGST } from '@/lib/gst'
import { formatCurrency } from '@/lib/format'
import { toDateOnly } from '@/lib/membership'
import { openRazorpayCheckout } from '@/lib/razorpay'
import { supabase } from '@/lib/supabase'

export type CheckoutMember = { id: string; name: string; phone: string | null; email?: string | null }
type Stage = 'ready' | 'processing' | 'success' | 'failure'

function fallbackPricing(plan: MembershipPlan | null): PricingBreakdown {
  const amount = Number(plan?.price ?? 0)
  const gst = calculateGST(amount, 0)
  return { amount, discountAmount: 0, taxableAmount: gst.taxableAmount, gstRate: 5, cgstAmount: gst.cgstAmount, sgstAmount: gst.sgstAmount, totalAmount: gst.totalAmount, totalPaise: Math.round(gst.totalAmount * 100), promoCodeId: null, promoCode: null }
}

export function PlanCheckout({ open, onOpenChange, member, initialPlan, onSuccess, membershipPath }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  member: CheckoutMember
  initialPlan?: MembershipPlan | null
  onSuccess?: () => void | Promise<void>
  membershipPath: string
}) {
  const { gym } = useGym()
  const { activePlans } = usePlans()
  const { previewOrder, createOrder, reconcileCompletedCheckout, handlePaymentSuccess } = usePayments()
  const [planId, setPlanId] = useState(initialPlan?.id ?? '')
  const [startDate, setStartDate] = useState(toDateOnly())
  const [promo, setPromo] = useState('')
  const [quote, setQuote] = useState<OrderResult | null>(null)
  const [quoting, setQuoting] = useState(false)
  const [stage, setStage] = useState<Stage>('ready')
  const [failure, setFailure] = useState('Payment failed. Please try again.')
  const [successMessage, setSuccessMessage] = useState('The membership and invoice are ready.')

  const plan = useMemo(() => initialPlan?.id === planId ? initialPlan : activePlans.find(item => item.id === planId) ?? null, [activePlans, initialPlan, planId])
  const pricing = quote ?? fallbackPricing(plan)

  useEffect(() => {
    if (!open) return
    setPlanId(initialPlan?.id ?? '')
    setStartDate(toDateOnly())
    setPromo('')
    setQuote(null)
    setStage('ready')
    setFailure('Payment failed. Please try again.')
    setSuccessMessage('The membership and invoice are ready.')
  }, [initialPlan?.id, open])

  useEffect(() => {
    if (plan?.allow_future_start === false) setStartDate(toDateOnly())
  }, [plan?.allow_future_start])

  useEffect(() => {
    if (!open || !plan) return
    let alive = true
    setQuoting(true)
    previewOrder({ planId: plan.id, memberId: member.id, startDate: plan.allow_future_start ? startDate : toDateOnly() }).then(result => {
      if (alive) setQuote(result)
    }).catch(() => { if (alive) setQuote(null) }).finally(() => { if (alive) setQuoting(false) })
    return () => { alive = false }
  }, [member.id, open, plan, previewOrder, startDate])

  async function applyPromo() {
    if (!plan || !promo.trim()) { toast.error('Enter a promo code'); return }
    setQuoting(true)
    try {
      if (supabase && gym) {
        const { data, error } = await supabase.rpc('validate_promo_code' as never, { p_gym_id: gym.gym_id, p_code: promo.trim(), p_plan_id: plan.id } as never)
        if (error) throw error
        const validation = data as { valid?: boolean; error?: string }
        if (!validation?.valid) throw new Error(validation?.error ?? 'Invalid promo code')
      }
      const result = await previewOrder({ planId: plan.id, memberId: member.id, startDate, promoCode: promo })
      setQuote(result)
      setPromo(result.promoCode ?? promo.trim().toUpperCase())
      toast.success(`${formatCurrency(result.discountAmount)} discount applied`)
    } catch (cause) {
      setQuote(null)
      toast.error(cause instanceof Error ? cause.message : 'Invalid promo code')
    } finally { setQuoting(false) }
  }

  async function showSuccess(message = 'The membership and invoice are ready.') {
    setSuccessMessage(message)
    setStage('success')
    toast.success('Payment successful! Membership activated.')
    onOpenChange(false)
    try {
      await onSuccess?.()
    } catch {
      toast.warning('Payment succeeded, but the latest membership details could not be refreshed. Refresh the page to try again.')
    }
  }

  function showFailure(message: string) {
    setFailure(message)
    setStage('failure')
    toast.error(message)
  }

  async function completePayment(paymentId: string | null, alreadyCaptured = false) {
    try {
      if (!alreadyCaptured) {
        if (!paymentId) throw new Error('Payment confirmation is missing')
        await handlePaymentSuccess(paymentId)
      }
    } catch (cause) {
      showFailure(cause instanceof Error ? cause.message : 'Payment could not be confirmed')
      return
    }
    await showSuccess()
  }

  async function pay() {
    if (!plan) { toast.error('Select a membership plan'); return }
    setStage('processing')
    const attemptedAfter = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    try {
      const result = await createOrder({ planId: plan.id, memberId: member.id, startDate, promoCode: quote?.promoCode ?? undefined })
      if (result.free === true || result.captured === true) {
        await completePayment(result.paymentId, true)
        return
      }
      if (!result.orderId || !result.paymentId || !result.razorpayKeyId) throw new Error('Checkout could not be initialized')
      await openRazorpayCheckout({
        orderId: result.orderId, amount: result.totalPaise, currency: result.currency,
        gymName: gym?.name ?? 'FitStack', description: plan.name, gymLogo: gym?.logo_url, brandColor: gym?.brand_color,
        customerName: member.name, customerPhone: member.phone ?? '', customerEmail: member.email,
        razorpayKeyId: result.razorpayKeyId,
        onSuccess: response => {
          if (!response.razorpay_payment_id) {
            showFailure('Payment confirmation is missing. Please check payment history before trying again.')
            return
          }
          void showSuccess()
          void handlePaymentSuccess(result.paymentId).then(() => onSuccess?.()).catch(() => undefined)
        },
        onFailure: error => {
          const dismissed = typeof error === 'object' && error !== null && 'reason' in error && (error as { reason?: string }).reason === 'dismissed'
          showFailure(dismissed ? 'Checkout was closed before payment. You can try again when ready.' : 'Payment failed. No membership was created. Please try again.')
        },
      })
    } catch (cause) {
      const completed = await reconcileCompletedCheckout({ planId: plan.id, memberId: member.id, startDate, promoCode: quote?.promoCode ?? undefined }, attemptedAfter)
      if (completed) {
        await showSuccess(completed.status === 'scheduled' ? 'Membership already created and scheduled.' : 'Membership already active.')
        return
      }
      showFailure(cause instanceof Error ? cause.message : 'Payment failed. Please try again.')
    }
  }

  return <Dialog open={open} onOpenChange={value => { if (stage !== 'processing') onOpenChange(value) }}><DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
    {stage === 'success' ? <div className="flex flex-col items-center py-10 text-center" role="status"><div className="mb-5 rounded-full bg-emerald-100 p-4 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"><CheckCircle2 className="size-12" aria-hidden="true" /></div><DialogTitle className="text-2xl">Payment successful</DialogTitle><DialogDescription className="mt-2 max-w-md">{successMessage}</DialogDescription><div className="mt-6 flex flex-col gap-2 sm:flex-row"><Button nativeButton={false} render={<Link to={membershipPath} onClick={() => onOpenChange(false)}>View membership</Link>} /><Button variant="outline" onClick={() => onOpenChange(false)}>Done</Button></div></div> : stage === 'failure' ? <div className="flex flex-col items-center py-10 text-center" role="alert"><div className="mb-5 rounded-full bg-red-100 p-4 text-red-700 dark:bg-red-950 dark:text-red-300"><TriangleAlert className="size-10" aria-hidden="true" /></div><DialogTitle className="text-2xl">Payment not completed</DialogTitle><DialogDescription className="mt-2 max-w-md">{failure}</DialogDescription><div className="mt-6 flex gap-2"><Button onClick={() => setStage('ready')}><RefreshCw aria-hidden="true" /> Try again</Button><Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button></div></div> : <>
      <DialogHeader><DialogTitle>Membership checkout</DialogTitle><DialogDescription>Review the plan, discount, taxes, and total before paying.</DialogDescription></DialogHeader>
      {quote?.simulated && <Alert><TriangleAlert aria-hidden="true" /><AlertTitle>Development mode</AlertTitle><AlertDescription>Razorpay is not configured. Payment will be simulated securely and an invoice will still be generated.</AlertDescription></Alert>}
      <div className="rounded-lg border bg-muted/30 p-4"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Member</p><p className="mt-1 font-semibold">{member.name}</p><p className="text-sm text-muted-foreground">{member.phone || 'No phone number'}</p></div>
      {!initialPlan && <div className="space-y-2"><Label>Membership plan *</Label><Select value={planId} onValueChange={value => { setPlanId(value ?? ''); setPromo(''); setQuote(null) }}><SelectTrigger><SelectValue placeholder="Select a plan" /></SelectTrigger><SelectContent>{activePlans.map(item => <SelectItem key={item.id} value={item.id}>{item.name} — {formatCurrency(Number(item.price))}</SelectItem>)}</SelectContent></Select></div>}
      {plan && <div className="rounded-lg border p-4"><div className="flex items-start justify-between gap-4"><div><p className="font-semibold">{plan.name}</p><p className="text-sm text-muted-foreground">Plan price before GST</p></div><p className="font-semibold tabular-nums">{formatCurrency(Number(plan.price))}</p></div></div>}
      {plan && <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="checkout-promo">Promo code</Label><div className="flex gap-2"><Input id="checkout-promo" autoComplete="off" value={promo} onChange={event => { setPromo(event.target.value.toUpperCase().replace(/\s/g, '')); if (quote?.promoCode) setQuote(null) }} placeholder="Optional" /><Button type="button" variant="outline" disabled={quoting || !promo} onClick={() => void applyPromo()}>{quoting ? 'Checking…' : 'Apply'}</Button></div></div><div className="space-y-2"><Label htmlFor="checkout-start">Start date</Label><Input id="checkout-start" type="date" min={toDateOnly()} value={startDate} disabled={!plan.allow_future_start} onChange={event => { setStartDate(event.target.value); setQuote(null) }} /><p className="text-xs text-muted-foreground">{plan.allow_future_start ? 'Today or a future date.' : 'This plan starts today.'}</p></div></div>}
      {plan && <div className="space-y-2 rounded-xl border p-4 text-sm tabular-nums"><div className="flex justify-between"><span>Plan price</span><span>{formatCurrency(pricing.amount)}</span></div>{pricing.discountAmount > 0 && <div className="flex justify-between text-emerald-700 dark:text-emerald-300"><span>Promo ({pricing.promoCode})</span><span>−{formatCurrency(pricing.discountAmount)}</span></div>}<div className="flex justify-between border-t pt-2"><span>Taxable amount</span><span>{formatCurrency(pricing.taxableAmount)}</span></div>{pricing.gstRate > 0 && <><div className="flex justify-between text-muted-foreground"><span>CGST (2.5%)</span><span>{formatCurrency(pricing.cgstAmount)}</span></div><div className="flex justify-between text-muted-foreground"><span>SGST (2.5%)</span><span>{formatCurrency(pricing.sgstAmount)}</span></div></>}<div className="mt-2 flex justify-between border-t pt-3 text-base font-semibold"><span>Total</span><span>{formatCurrency(pricing.totalAmount)}</span></div></div>}
      <div className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="size-4" aria-hidden="true" /><span>Amounts and promo eligibility are recalculated on the server.</span></div>
      <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)} disabled={stage === 'processing'}>Cancel</Button><Button disabled={!plan || quoting || stage === 'processing'} onClick={() => void pay()}><CreditCard aria-hidden="true" />{stage === 'processing' ? 'Preparing payment…' : pricing.totalAmount === 0 ? 'Activate free plan' : `Pay ${formatCurrency(pricing.totalAmount)}`}</Button></DialogFooter>
    </>}
  </DialogContent></Dialog>
}
