export type RazorpaySuccessResponse = {
  razorpay_payment_id: string
  razorpay_order_id: string
  razorpay_signature: string
}

export interface RazorpayCheckoutOptions {
  orderId: string
  amount: number
  currency: string
  gymName: string
  gymLogo?: string | null
  customerName: string
  customerPhone: string
  customerEmail?: string | null
  razorpayKeyId: string
  onSuccess: (response: RazorpaySuccessResponse) => void
  onFailure: (error: unknown) => void
}

type RazorpayInstance = { open: () => void; on: (event: string, callback: (value: unknown) => void) => void }
type RazorpayConstructor = new (options: Record<string, unknown>) => RazorpayInstance

declare global { interface Window { Razorpay?: RazorpayConstructor } }

let loading: Promise<void> | null = null

export function loadRazorpayScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve()
  if (loading) return loading
  loading = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById('razorpay-script') as HTMLScriptElement | null
    const script = existing ?? document.createElement('script')
    script.id = 'razorpay-script'
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.async = true
    script.addEventListener('load', () => window.Razorpay ? resolve() : reject(new Error('Razorpay checkout did not initialize')), { once: true })
    script.addEventListener('error', () => reject(new Error('Failed to load Razorpay checkout')), { once: true })
    if (!existing) document.body.appendChild(script)
  }).catch(error => { loading = null; throw error })
  return loading!
}

export async function openRazorpayCheckout(options: RazorpayCheckoutOptions) {
  await loadRazorpayScript()
  if (!window.Razorpay) throw new Error('Razorpay checkout is unavailable')
  let completed = false
  const checkout = new window.Razorpay({
    key: options.razorpayKeyId,
    amount: options.amount,
    currency: options.currency || 'INR',
    name: options.gymName,
    image: options.gymLogo || undefined,
    order_id: options.orderId,
    prefill: { name: options.customerName, contact: options.customerPhone, email: options.customerEmail || undefined },
    theme: { color: '#171717' },
    handler: (response: RazorpaySuccessResponse) => { completed = true; options.onSuccess(response) },
    modal: { ondismiss: () => { if (!completed) options.onFailure({ reason: 'dismissed' }) } },
  })
  checkout.on('payment.failed', options.onFailure)
  checkout.open()
}
