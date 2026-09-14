export function parsePaymentResult<T extends { captured: boolean }>(data: unknown): T {
  let result = data
  if (typeof result === 'string') {
    try { result = JSON.parse(result) } catch { throw new Error('Checkout returned an invalid response') }
  }
  if (Array.isArray(result)) result = result[0]
  if (result && typeof result === 'object') {
    const record = result as Record<string, unknown>
    result = record.result ?? record.simulate_payment_checkout ?? result
  }
  if (!result || typeof result !== 'object' || typeof (result as { captured?: unknown }).captured !== 'boolean') {
    throw new Error('Checkout returned an invalid response')
  }
  return result as T
}
