import { authenticatedAdmin, corsHeaders, HttpError, json, money, serverPromo, todayIndia, validDateOnly, type JsonRecord } from '../_shared/fitstack.ts'

function text(value: unknown) { return String(value ?? '').trim() }

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  try {
    const { user, admin } = await authenticatedAdmin(req)
    const body = await req.json() as JsonRecord
    const gymId = text(body.gym_id)
    const memberId = text(body.member_id)
    const planId = text(body.plan_id)
    const startDate = validDateOnly(body.start_date, 'start date')
    const today = todayIndia()
    if (startDate < today) throw new HttpError('Start date cannot be in the past')
    if (!gymId || !memberId || !planId) throw new HttpError('Gym, member, and plan are required')

    const [{ data: gym }, { data: actor }, { data: member }, { data: plan }, { data: existing, error: existingError }] = await Promise.all([
      admin.from('gyms').select('id,name,gstin,is_active,razorpay_key_id_enc,razorpay_key_secret_enc,razorpay_webhook_secret_enc').eq('id', gymId).maybeSingle(),
      admin.from('gym_members').select('id,role').eq('gym_id', gymId).eq('profile_id', user.id).eq('is_active', true).maybeSingle(),
      admin.from('gym_members').select('id,profile_id,is_active').eq('id', memberId).eq('gym_id', gymId).maybeSingle(),
      admin.from('membership_plans').select('*').eq('id', planId).eq('gym_id', gymId).eq('is_active', true).maybeSingle(),
      admin.from('memberships').select('id,status,end_date').eq('gym_id', gymId).eq('member_id', memberId).in('status', ['active', 'frozen', 'scheduled']),
    ])
    if (!gym?.is_active) throw new HttpError('Gym is inactive', 403)
    if (!actor) throw new HttpError('You do not have access to this gym', 403)
    const staff = ['owner', 'admin', 'receptionist'].includes(actor.role)
    if (!staff && actor.id !== memberId) throw new HttpError('You can only purchase a membership for yourself', 403)
    if (!member?.is_active) throw new HttpError('Member was not found')
    if (!plan) throw new HttpError('Choose an active membership plan')
    if (existingError) throw existingError
    const current = existing?.find(item => ['active', 'frozen'].includes(item.status))
    if (existing?.some(item => item.status === 'scheduled')) throw new HttpError('Member already has a scheduled renewal. Cancel it first to create a new one.')
    if (current && startDate <= current.end_date) throw new HttpError('Member already has an active membership. Choose a future start date for renewal.')
    if (!plan.allow_future_start && startDate !== today) throw new HttpError('This plan must start today')

    const amount = money(Number(plan.price))
    const promo = await serverPromo(admin, gymId, body.promo_code, planId, amount)
    const taxableAmount = money(amount - promo.discount)
    const gstRate = text(gym.gstin) ? 5 : 0
    const cgstAmount = money(taxableAmount * gstRate / 200)
    const sgstAmount = cgstAmount
    const totalAmount = money(taxableAmount + cgstAmount + sgstAmount)
    const totalPaise = Math.round(totalAmount * 100)
    const configured = Boolean(text(gym.razorpay_key_id_enc) && text(gym.razorpay_key_secret_enc) && text(gym.razorpay_webhook_secret_enc))
    const pricing = { amount, discountAmount: promo.discount, taxableAmount, gstRate, cgstAmount, sgstAmount, totalAmount, totalPaise, promoCodeId: promo.id, promoCode: promo.code }
    if (body.preview === true) return json({ ...pricing, orderId: null, paymentId: null, razorpayKeyId: configured ? gym.razorpay_key_id_enc : null, currency: 'INR', simulated: !configured, captured: false })

    let orderId: string | null = null
    const simulated = !configured
    if (totalPaise > 0 && configured) {
      const response = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST', headers: { Authorization: `Basic ${btoa(`${gym.razorpay_key_id_enc}:${gym.razorpay_key_secret_enc}`)}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: totalPaise, currency: 'INR', receipt: `fit_${crypto.randomUUID().replaceAll('-', '').slice(0, 32)}`, notes: { gym_id: gymId, member_id: memberId, plan_id: planId, start_date: startDate, promo_code_id: promo.id ?? '' } }),
      })
      const order = await response.json() as { id?: string; amount?: number; currency?: string; error?: { description?: string } }
      if (!response.ok || !order.id) throw new HttpError(order.error?.description ?? 'Razorpay order creation failed', 502)
      if (order.amount !== totalPaise || order.currency !== 'INR') throw new HttpError('Razorpay returned an unexpected order amount', 502)
      orderId = order.id
    } else if (totalPaise > 0) orderId = `order_dev_${crypto.randomUUID().replaceAll('-', '')}`

    const { data: payment, error: paymentError } = await admin.from('payments').insert({
      gym_id: gymId, member_id: memberId, plan_id: planId, requested_start_date: startDate,
      amount, discount_amount: promo.discount, taxable_amount: taxableAmount, gst_rate: gstRate,
      cgst_amount: cgstAmount, sgst_amount: sgstAmount, total_amount: totalAmount, currency: 'INR',
      razorpay_order_id: orderId, status: 'created', promo_code_id: promo.id, description: plan.name, created_by: actor.id,
      metadata: { purchase_mode: current ? 'renewal' : 'new', duration_type: plan.duration_type, duration_value: plan.duration_value, max_freezes: plan.max_freezes, max_freeze_days: plan.max_freeze_days, simulated },
    }).select('id').single()
    if (paymentError) throw paymentError
    if (simulated || totalPaise === 0) {
      const paymentId = totalPaise > 0 ? `pay_dev_${crypto.randomUUID().replaceAll('-', '')}` : null
      const eventId = totalPaise > 0 ? `event_dev_${crypto.randomUUID().replaceAll('-', '')}` : null
      const eventPayload = totalPaise > 0 ? { event: 'payment.captured', payload: { payment: { entity: { id: paymentId, order_id: orderId, amount: totalPaise, currency: 'INR' } } } } : null
      const { data: capture, error: captureError } = await admin.rpc('process_payment_capture', {
        p_payment_id: payment.id, p_razorpay_payment_id: paymentId, p_razorpay_signature: totalPaise > 0 ? 'development-simulation' : null,
        p_plan_id: planId, p_start_date: startDate, p_event_id: eventId, p_event_payload: eventPayload,
      })
      if (captureError) {
        await admin.from('payments').delete().eq('id', payment.id)
        throw captureError
      }
      return json({ ...pricing, orderId, paymentId: payment.id, razorpayKeyId: null, currency: 'INR', simulated, captured: true, invoiceId: capture?.invoice_id ?? null, membershipId: capture?.membership_id ?? null })
    }

    return json({ ...pricing, orderId, paymentId: payment.id, razorpayKeyId: gym.razorpay_key_id_enc, currency: 'INR', simulated: false, captured: false })
  } catch (error) {
    console.error(error)
    const status = error instanceof HttpError ? error.status : 500
    return json({ error: error instanceof Error ? error.message : 'Could not create checkout' }, status)
  }
})
