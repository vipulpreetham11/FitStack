import { createClient } from 'npm:@supabase/supabase-js@2.109.0'
import { envKey, HttpError, json, type JsonRecord } from '../_shared/fitstack.ts'

function nested(record: JsonRecord, ...path: string[]): unknown {
  let current: unknown = record
  for (const key of path) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return undefined
    current = (current as JsonRecord)[key]
  }
  return current
}

async function validHmac(rawBody: string, received: string, secret: string) {
  if (!/^[a-f0-9]{64}$/i.test(received)) return false
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const digest = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody)))
  const expected = [...digest].map(byte => byte.toString(16).padStart(2, '0')).join('')
  let difference = 0
  for (let index = 0; index < expected.length; index++) difference |= expected.charCodeAt(index) ^ received.toLowerCase().charCodeAt(index)
  return difference === 0
}

Deno.serve(async req => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, false)
  try {
    const rawBody = await req.text()
    const eventId = req.headers.get('x-razorpay-event-id')?.trim()
    const signature = req.headers.get('x-razorpay-signature')?.trim()
    if (!eventId || !signature) throw new HttpError('Missing Razorpay webhook headers', 400)
    let payload: JsonRecord
    try { payload = JSON.parse(rawBody) as JsonRecord } catch { throw new HttpError('Invalid JSON payload') }
    const eventType = String(payload.event ?? '')
    if (!['payment.captured', 'payment.failed'].includes(eventType)) return json({ received: true, ignored: true }, 200, false)
    const orderId = String(nested(payload, 'payload', 'payment', 'entity', 'order_id') ?? '')
    const razorpayPaymentId = String(nested(payload, 'payload', 'payment', 'entity', 'id') ?? '')
    if (!orderId || !razorpayPaymentId) throw new HttpError('Payment identifiers are missing')

    const url = Deno.env.get('SUPABASE_URL') ?? ''
    const secretKey = envKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY')
    if (!url || !secretKey) throw new HttpError('Function is not configured', 500)
    const admin = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: payment, error: paymentError } = await admin.from('payments').select('*').eq('razorpay_order_id', orderId).maybeSingle()
    if (paymentError) throw paymentError
    if (!payment) throw new HttpError('Payment order was not found', 404)
    const { data: gym, error: gymError } = await admin.from('gyms').select('razorpay_webhook_secret_enc').eq('id', payment.gym_id).single()
    if (gymError) throw gymError
    const webhookSecret = String(gym.razorpay_webhook_secret_enc ?? '')
    if (!webhookSecret) throw new HttpError('Webhook secret is not configured', 500)
    if (!await validHmac(rawBody, signature, webhookSecret)) throw new HttpError('Invalid webhook signature', 401)

    const { data: existing, error: existingError } = await admin.from('razorpay_webhook_events').select('id,processed,payment_id').eq('event_id', eventId).maybeSingle()
    if (existingError) throw existingError
    if (existing && existing.payment_id !== payment.id) throw new HttpError('Webhook event does not match payment', 409)
    if (existing?.processed) return json({ received: true, duplicate: true }, 200, false)

    if (eventType === 'payment.captured') {
      const { data, error } = await admin.rpc('process_payment_capture', {
        p_payment_id: payment.id, p_razorpay_payment_id: razorpayPaymentId, p_razorpay_signature: signature,
        p_plan_id: payment.plan_id, p_start_date: payment.requested_start_date, p_event_id: eventId, p_event_payload: payload,
      })
      if (error) throw error
      return json({ received: true, result: data }, 200, false)
    }

    let webhookId = existing?.id
    if (!webhookId) {
      const { data: inserted, error: insertError } = await admin.from('razorpay_webhook_events').insert({
        gym_id: payment.gym_id, payment_id: payment.id, event_id: eventId, event_type: eventType, payload,
      }).select('id').single()
      if (insertError && insertError.code !== '23505') throw insertError
      webhookId = inserted?.id
    }
    if (!webhookId) {
      const { data } = await admin.from('razorpay_webhook_events').select('id,processed,payment_id').eq('event_id', eventId).single()
      if (data.payment_id !== payment.id) throw new HttpError('Webhook event does not match payment', 409)
      if (data.processed) return json({ received: true, duplicate: true }, 200, false)
      webhookId = data.id
    }
    const { error: updateError } = await admin.from('payments').update({ status: 'failed', razorpay_payment_id: razorpayPaymentId }).eq('id', payment.id).neq('status', 'captured')
    if (updateError) throw updateError
    const { error: logError } = await admin.from('razorpay_webhook_events').update({ processed: true, processed_at: new Date().toISOString() }).eq('id', webhookId)
    if (logError) throw logError
    return json({ received: true }, 200, false)
  } catch (error) {
    console.error(error)
    const status = error instanceof HttpError ? error.status : 500
    return json({ error: status >= 500 ? 'Webhook processing failed' : error instanceof Error ? error.message : 'Invalid webhook' }, status, false)
  }
})
