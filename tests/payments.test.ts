import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseCheckoutOrderResult, parsePaymentResult } from '../src/lib/payment'

const checkoutSource = readFileSync(
  new URL('../src/components/payments/PlanCheckout.tsx', import.meta.url),
  'utf8',
)
const paymentsHookSource = readFileSync(new URL('../src/hooks/usePayments.ts', import.meta.url), 'utf8')
const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8')

const success = {
  simulated: true,
  captured: true,
  paymentId: '00000000-0000-4000-8000-000000000121',
  membershipId: '00000000-0000-4000-8000-000000000122',
  invoiceId: '00000000-0000-4000-8000-000000000123',
  totalAmount: 5250,
  orderId: 'dev_order_test',
}

describe('payment RPC responses', () => {
  it('preserves the captured flag from the direct JSON response', () => {
    expect(parsePaymentResult(success).captured).toBe(true)
  })

  it('unwraps serialized, row, and named RPC response shapes', () => {
    expect(parsePaymentResult(JSON.stringify(success)).captured).toBe(true)
    expect(parsePaymentResult([{ result: success }]).captured).toBe(true)
    expect(parsePaymentResult({ simulate_payment_checkout: success }).captured).toBe(true)
  })

  it('rejects a response without an explicit boolean captured field', () => {
    expect(() => parsePaymentResult({ ...success, captured: 'true' })).toThrow(/invalid response/i)
  })

  it('routes an explicitly captured checkout response to the success path', () => {
    expect(checkoutSource).toContain('if (result.free === true || result.captured === true)')
    expect(checkoutSource).toContain("await completePayment(result.paymentId, true)")
  })
})

describe('Razorpay Edge Function responses', () => {
  it('normalizes a paid order response from the deployed function', () => {
    expect(parseCheckoutOrderResult({
      free: false,
      orderId: 'order_test',
      amount: 525000,
      totalPaise: 525000,
      currency: 'INR',
      keyId: 'rzp_test_fitstack',
      paymentId: success.paymentId,
    })).toMatchObject({
      free: false,
      captured: false,
      orderId: 'order_test',
      totalPaise: 525000,
      razorpayKeyId: 'rzp_test_fitstack',
      paymentId: success.paymentId,
    })
  })

  it('treats a free checkout response as captured without requiring Razorpay fields', () => {
    expect(parseCheckoutOrderResult({
      free: true,
      paymentId: success.paymentId,
      membershipId: success.membershipId,
      invoiceId: success.invoiceId,
    })).toMatchObject({ free: true, captured: true, totalPaise: 0 })
  })

  it('accepts a captured simulation returned by the credentials fallback', () => {
    expect(parseCheckoutOrderResult(success)).toMatchObject({
      free: false,
      simulated: true,
      captured: true,
      paymentId: success.paymentId,
    })
  })

  it('uses the Edge Function first and limits simulation to the credentials fallback', () => {
    expect(paymentsHookSource).toContain("functions.invoke('create-razorpay-order'")
    expect(paymentsHookSource).toMatch(/failure\.status === 400.*Razorpay credentials are not configured/s)
    expect(paymentsHookSource).not.toContain('isPaymentDevMode')
    expect(indexHtml).toContain('src="https://checkout.razorpay.com/v1/checkout.js"')
  })

  it('accepts Razorpay success from the payment id and keeps webhook confirmation in the background', () => {
    expect(checkoutSource).toContain('if (!response.razorpay_payment_id)')
    expect(checkoutSource).toContain("toast.success('Payment successful! Membership activated.')")
    expect(checkoutSource).toContain('handlePaymentSuccess(result.paymentId).then')
  })
})
