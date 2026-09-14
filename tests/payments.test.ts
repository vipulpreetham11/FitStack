import { describe, expect, it } from 'vitest'
import { parsePaymentResult } from '../src/lib/payment'

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
})
