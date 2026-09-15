function unwrapPaymentResult(data: unknown) {
  let result = data
  if (typeof result === 'string') {
    try { result = JSON.parse(result) } catch { throw new Error('Checkout returned an invalid response') }
  }
  if (Array.isArray(result)) result = result[0]
  if (result && typeof result === 'object') {
    const record = result as Record<string, unknown>
    result = record.result ?? record.simulate_payment_checkout ?? result
  }
  return result
}

export function parsePaymentResult<T extends { captured: boolean }>(data: unknown): T {
  const result = unwrapPaymentResult(data)
  if (!result || typeof result !== 'object' || typeof (result as { captured?: unknown }).captured !== 'boolean') {
    throw new Error('Checkout returned an invalid response')
  }
  return result as T
}

export type CheckoutOrderResult = {
  orderId: string | null
  paymentId: string
  razorpayKeyId: string | null
  totalPaise: number
  currency: string
  simulated: boolean
  captured: boolean
  free: boolean
  invoiceId: string | null
  membershipId: string | null
}

export function parseCheckoutOrderResult(data: unknown): CheckoutOrderResult {
  const result = unwrapPaymentResult(data)
  if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('Checkout returned an invalid response')
  const record = result as Record<string, unknown>
  const free = record.free === true
  const captured = free || record.captured === true
  const paymentId = typeof record.paymentId === 'string' ? record.paymentId.trim() : ''
  const orderId = typeof record.orderId === 'string' && record.orderId.trim() ? record.orderId.trim() : null
  const key = record.keyId ?? record.razorpayKeyId
  const razorpayKeyId = typeof key === 'string' && key.trim() ? key.trim() : null
  const totalPaise = Number(record.totalPaise ?? record.amount ?? 0)
  if (!paymentId || !Number.isSafeInteger(totalPaise) || totalPaise < 0) throw new Error('Checkout returned invalid payment details')
  if (!captured && (!orderId || !razorpayKeyId || totalPaise === 0)) throw new Error('Checkout could not be initialized')
  return {
    orderId,
    paymentId,
    razorpayKeyId,
    totalPaise,
    currency: typeof record.currency === 'string' && record.currency ? record.currency : 'INR',
    simulated: record.simulated === true,
    captured,
    free,
    invoiceId: typeof record.invoiceId === 'string' ? record.invoiceId : null,
    membershipId: typeof record.membershipId === 'string' ? record.membershipId : null,
  }
}
