import { createClient } from 'npm:@supabase/supabase-js@2.109.0'
import { corsHeaders } from 'npm:@supabase/supabase-js@2.109.0/cors'

type JsonRecord = Record<string, unknown>
type AdminClient = ReturnType<typeof createClient>

class HttpError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message)
  }
}

const DAY_MS = 86_400_000

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: corsHeaders })
}

function envKey(jsonName: string, singleName: string, legacyName: string) {
  const grouped = Deno.env.get(jsonName)
  if (grouped) {
    const parsed = JSON.parse(grouped) as Record<string, string>
    if (parsed.default) return parsed.default
  }
  return Deno.env.get(singleName) ?? Deno.env.get(legacyName) ?? ''
}

function todayIndia() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const part = (type: string) => parts.find(item => item.type === type)?.value
  return `${part('year')}-${part('month')}-${part('day')}`
}

function parseDateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new HttpError('Choose a valid start date')
  const date = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new HttpError('Choose a valid start date')
  return date
}

function addDays(value: string, days: number) {
  const date = parseDateOnly(value)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function daysBetween(start: string, end: string) {
  return Math.max(0, Math.floor((parseDateOnly(end).getTime() - parseDateOnly(start).getTime()) / DAY_MS))
}

function calculateEndDate(start: string, type: string, value: number) {
  if (!Number.isInteger(value) || value < 1) throw new HttpError('Plan duration is invalid')
  if (type === 'days') return addDays(start, value - 1)
  if (!['months', 'years'].includes(type)) throw new HttpError('Plan duration is invalid')
  const date = parseDateOnly(start)
  const year = date.getUTCFullYear() + (type === 'years' ? value : 0)
  const month = date.getUTCMonth() + (type === 'months' ? value : 0)
  const target = new Date(Date.UTC(year, month, 1))
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(date.getUTCDate(), lastDay))
  target.setUTCDate(target.getUTCDate() - 1)
  return target.toISOString().slice(0, 10)
}

function positiveDays(value: unknown, label: string) {
  const days = Number(value)
  if (!Number.isInteger(days) || days < 1) throw new HttpError(`${label} must be at least 1 day`)
  return days
}

async function syncScheduledRenewal(admin: AdminClient, current: JsonRecord, actorId: string) {
  const { data: scheduled, error } = await admin.from('memberships').select('*').eq('gym_id', current.gym_id).eq('member_id', current.member_id).eq('status', 'scheduled').maybeSingle()
  if (error) throw error
  if (!scheduled) return
  const { data: plan, error: planError } = await admin.from('membership_plans').select('duration_type,duration_value').eq('id', scheduled.plan_id).single()
  if (planError) throw planError
  const newStart = addDays(String(current.end_date), 1)
  if (scheduled.start_date === newStart) return
  const newEnd = calculateEndDate(newStart, plan.duration_type, plan.duration_value)
  const { error: updateError } = await admin.from('memberships').update({ start_date: newStart, end_date: newEnd }).eq('id', scheduled.id)
  if (updateError) throw updateError
  const { error: eventError } = await admin.from('membership_events').insert({
    gym_id: scheduled.gym_id,
    membership_id: scheduled.id,
    event_type: 'extended',
    from_status: 'scheduled',
    to_status: 'scheduled',
    performed_by: actorId,
    details: { reason: 'Renewal rescheduled with current membership', old_start_date: scheduled.start_date, new_start_date: newStart },
  })
  if (eventError) throw eventError
}

async function createMembership(admin: AdminClient, actorId: string, body: JsonRecord) {
  const gymId = String(body.gymId ?? '')
  const memberId = String(body.memberId ?? '')
  const planId = String(body.planId ?? '')
  const requestedStart = String(body.startDate ?? '')
  const today = todayIndia()
  parseDateOnly(requestedStart)
  if (requestedStart < today) throw new HttpError('Start date cannot be in the past')

  const [{ data: member, error: memberError }, { data: plan, error: planError }, { data: existing, error: existingError }] = await Promise.all([
    admin.from('gym_members').select('id').eq('id', memberId).eq('gym_id', gymId).eq('is_active', true).single(),
    admin.from('membership_plans').select('*').eq('id', planId).eq('gym_id', gymId).eq('is_active', true).single(),
    admin.from('memberships').select('*').eq('gym_id', gymId).eq('member_id', memberId).in('status', ['active', 'frozen', 'scheduled']),
  ])
  if (memberError || !member) throw new HttpError('Member was not found')
  if (planError || !plan) throw new HttpError('Choose an active membership plan')
  if (existingError) throw existingError
  const current = existing?.find(item => ['active', 'frozen'].includes(item.status))
  const scheduled = existing?.find(item => item.status === 'scheduled')
  if (scheduled) throw new HttpError('Member already has a scheduled renewal. Cancel it first to create a new one.')
  if (current && requestedStart <= current.end_date) throw new HttpError('Member already has an active membership. Choose a future start date for renewal.')
  if (!plan.allow_future_start && requestedStart !== today) throw new HttpError('This plan must start today')

  const startDate = requestedStart
  const endDate = calculateEndDate(startDate, plan.duration_type, plan.duration_value)
  const amount = Number(plan.price)
  const halfTax = Math.round(amount * 2.5) / 100
  const total = Math.round((amount + halfTax * 2) * 100) / 100
  const status = startDate <= today ? 'active' : 'scheduled'
  const metadata = {
    purchase_mode: current ? 'renewal' : 'new',
    promo_code_entered: body.promoCode || null,
    duration_type: plan.duration_type,
    duration_value: plan.duration_value,
    max_freezes: plan.max_freezes,
    max_freeze_days: plan.max_freeze_days,
  }

  const { data: payment, error: paymentError } = await admin.from('payments').insert({
    gym_id: gymId,
    member_id: memberId,
    plan_id: planId,
    requested_start_date: startDate,
    amount,
    discount_amount: 0,
    taxable_amount: amount,
    gst_rate: 5,
    cgst_amount: halfTax,
    sgst_amount: halfTax,
    total_amount: total,
    status: 'created',
    description: plan.name,
    metadata,
    created_by: actorId,
  }).select('id').single()
  if (paymentError) throw paymentError

  let membershipId: string | null = null
  try {
    const { error: captureError } = await admin.from('payments').update({ status: 'captured' }).eq('id', payment.id)
    if (captureError) throw captureError
    const { data: membership, error: membershipError } = await admin.from('memberships').insert({
      gym_id: gymId,
      member_id: memberId,
      plan_id: planId,
      payment_id: payment.id,
      status,
      start_date: startDate,
      end_date: endDate,
      original_end_date: endDate,
      created_by: actorId,
    }).select('id').single()
    if (membershipError) throw membershipError
    membershipId = membership.id
    const { error: eventError } = await admin.from('membership_events').insert({
      gym_id: gymId,
      membership_id: membership.id,
      event_type: 'created',
      to_status: status,
      performed_by: actorId,
      details: { payment_id: payment.id },
    })
    if (eventError) throw eventError
    return { membershipId: membership.id, paymentId: payment.id, status }
  } catch (error) {
    if (membershipId) await admin.from('memberships').delete().eq('id', membershipId)
    await admin.from('payments').delete().eq('id', payment.id)
    throw error
  }
}

async function getMembership(admin: AdminClient, gymId: string, membershipId: string) {
  const { data, error } = await admin.from('memberships').select('*').eq('id', membershipId).eq('gym_id', gymId).single()
  if (error || !data) throw new HttpError('Membership was not found', 404)
  return data
}

async function freezeMembership(admin: AdminClient, actorId: string, body: JsonRecord) {
  const gymId = String(body.gymId ?? '')
  const membership = await getMembership(admin, gymId, String(body.membershipId ?? ''))
  if (membership.status !== 'active') throw new HttpError('Only an active membership can be frozen')
  const days = positiveDays(body.days, 'Freeze duration')
  const { data: plan, error: planError } = await admin.from('membership_plans').select('max_freezes,max_freeze_days').eq('id', membership.plan_id).single()
  if (planError) throw planError
  let maxFreezes = plan.max_freezes
  let maxFreezeDays = plan.max_freeze_days
  if (membership.payment_id) {
    const { data: payment } = await admin.from('payments').select('metadata').eq('id', membership.payment_id).maybeSingle()
    const snapshot = payment?.metadata as JsonRecord | undefined
    if (snapshot && Object.hasOwn(snapshot, 'max_freezes')) maxFreezes = snapshot.max_freezes as number | null
    if (snapshot && Object.hasOwn(snapshot, 'max_freeze_days')) maxFreezeDays = snapshot.max_freeze_days as number | null
  }
  if (maxFreezes === 0) throw new HttpError('Freezing is not allowed for this plan')
  if (maxFreezes !== null && membership.freeze_count >= maxFreezes) throw new HttpError('Maximum freezes reached for this plan')
  if (maxFreezeDays !== null && days > maxFreezeDays) throw new HttpError(`Maximum ${maxFreezeDays} days per freeze for this plan`)

  const frozenUntil = addDays(todayIndia(), days)
  const endDate = addDays(membership.end_date, days)
  const { data: freeze, error: freezeError } = await admin.from('membership_freezes').insert({
    gym_id: gymId,
    membership_id: membership.id,
    planned_days: days,
    reason: typeof body.reason === 'string' ? body.reason : null,
    created_by: actorId,
  }).select('id').single()
  if (freezeError) throw freezeError
  try {
    const { error: updateError } = await admin.from('memberships').update({
      status: 'frozen',
      frozen_at: new Date().toISOString(),
      frozen_until: frozenUntil,
      freeze_count: membership.freeze_count + 1,
      end_date: endDate,
    }).eq('id', membership.id)
    if (updateError) throw updateError
    const { error: eventError } = await admin.from('membership_events').insert({
      gym_id: gymId,
      membership_id: membership.id,
      event_type: 'frozen',
      from_status: 'active',
      to_status: 'frozen',
      performed_by: actorId,
      details: { days, reason: body.reason || null },
    })
    if (eventError) throw eventError
    await syncScheduledRenewal(admin, { ...membership, end_date: endDate }, actorId)
  } catch (error) {
    await admin.from('membership_freezes').delete().eq('id', freeze.id)
    await admin.from('memberships').update({ status: 'active', frozen_at: null, frozen_until: null, freeze_count: membership.freeze_count, end_date: membership.end_date }).eq('id', membership.id)
    throw error
  }
}

async function resumeMembership(admin: AdminClient, actorId: string, body: JsonRecord) {
  const gymId = String(body.gymId ?? '')
  const membership = await getMembership(admin, gymId, String(body.membershipId ?? ''))
  if (membership.status !== 'frozen' || !membership.frozen_at) throw new HttpError('Only a frozen membership can be resumed')
  const { data: freeze, error: freezeError } = await admin.from('membership_freezes').select('*').eq('membership_id', membership.id).is('resume_at', null).order('frozen_at', { ascending: false }).limit(1).single()
  if (freezeError || !freeze) throw new HttpError('Open freeze record was not found')
  const frozenDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(freeze.frozen_at))
  const actualDays = Math.min(freeze.planned_days, daysBetween(frozenDate, todayIndia()))
  const unusedDays = Math.max(0, freeze.planned_days - actualDays)
  const endDate = addDays(membership.end_date, -unusedDays)
  const { error: updateFreezeError } = await admin.from('membership_freezes').update({
    resume_at: new Date().toISOString(),
    actual_days: actualDays,
    resumed_early: unusedDays > 0,
  }).eq('id', freeze.id)
  if (updateFreezeError) throw updateFreezeError
  const { error: updateError } = await admin.from('memberships').update({
    status: 'active',
    frozen_at: null,
    frozen_until: null,
    end_date: endDate,
    total_freeze_days: membership.total_freeze_days + actualDays,
  }).eq('id', membership.id)
  if (updateError) throw updateError
  const { error: eventError } = await admin.from('membership_events').insert({
    gym_id: gymId,
    membership_id: membership.id,
    event_type: 'resumed',
    from_status: 'frozen',
    to_status: 'active',
    performed_by: actorId,
    details: { planned_days: freeze.planned_days, actual_days: actualDays, resumed_early: unusedDays > 0 },
  })
  if (eventError) throw eventError
  await syncScheduledRenewal(admin, { ...membership, end_date: endDate }, actorId)
}

async function extendMembership(admin: AdminClient, actorId: string, body: JsonRecord) {
  const gymId = String(body.gymId ?? '')
  const membership = await getMembership(admin, gymId, String(body.membershipId ?? ''))
  if (!['active', 'frozen'].includes(membership.status)) throw new HttpError('Only an active or frozen membership can be extended')
  const days = positiveDays(body.days, 'Extension')
  const reason = String(body.reason ?? '').trim()
  if (reason.length < 2) throw new HttpError('A reason is required')
  const endDate = addDays(membership.end_date, days)
  const { error: updateError } = await admin.from('memberships').update({ end_date: endDate }).eq('id', membership.id)
  if (updateError) throw updateError
  const { error: eventError } = await admin.from('membership_events').insert({
    gym_id: gymId,
    membership_id: membership.id,
    event_type: 'extended',
    from_status: membership.status,
    to_status: membership.status,
    performed_by: actorId,
    details: { days, reason, performed_by: actorId },
  })
  if (eventError) throw eventError
  await syncScheduledRenewal(admin, { ...membership, end_date: endDate }, actorId)
  return { endDate }
}

async function cancelMembership(admin: AdminClient, actorId: string, body: JsonRecord) {
  const gymId = String(body.gymId ?? '')
  const membership = await getMembership(admin, gymId, String(body.membershipId ?? ''))
  if (!['active', 'frozen', 'scheduled'].includes(membership.status)) throw new HttpError('This membership cannot be cancelled')
  const reason = String(body.reason ?? '').trim()
  if (reason.length < 2) throw new HttpError('A cancellation reason is required')
  const cancelledAt = new Date().toISOString()
  const targets = [membership]
  if (['active', 'frozen'].includes(membership.status)) {
    const { data: renewal, error } = await admin.from('memberships').select('*').eq('gym_id', gymId).eq('member_id', membership.member_id).eq('status', 'scheduled').maybeSingle()
    if (error) throw error
    if (renewal) targets.push(renewal)
  }
  for (const target of targets) {
    const { error: updateError } = await admin.from('memberships').update({
      status: 'cancelled',
      cancelled_at: cancelledAt,
      cancelled_by: actorId,
      cancellation_reason: reason,
    }).eq('id', target.id)
    if (updateError) throw updateError
    const { error: eventError } = await admin.from('membership_events').insert({
      gym_id: gymId,
      membership_id: target.id,
      event_type: 'cancelled',
      from_status: target.status,
      to_status: 'cancelled',
      performed_by: actorId,
      details: { reason, linked_cancellation: target.id !== membership.id },
    })
    if (eventError) throw eventError
  }
}

async function isAuthorizedCronRequest(admin: AdminClient, authorization: string | null) {
  const secret = authorization?.startsWith('Bearer ') ? authorization.slice(7) : ''
  if (!secret) return false
  const { data, error } = await admin.rpc('verify_membership_cron_secret', { p_secret: secret })
  if (error) throw error
  return data === true
}

async function processDailyMemberships(admin: AdminClient) {
  const { data, error } = await admin.rpc('run_membership_lifecycle')
  if (error) throw error
  return data ?? { expired: 0, activated: 0, resumed: 0, errors: [] }
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  try {
    const authorization = req.headers.get('Authorization')
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : ''
    if (!token) throw new HttpError('Sign in required', 401)
    const url = Deno.env.get('SUPABASE_URL') ?? ''
    const secretKey = envKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY')
    if (!url || !secretKey) throw new HttpError('Function is not configured', 500)
    const body = await req.json() as JsonRecord
    const admin = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } })

    if (body.action === 'process-daily' || body.action === undefined) {
      if (!await isAuthorizedCronRequest(admin, authorization)) throw new HttpError('Unauthorized', 401)
      const result = await processDailyMemberships(admin)
      console.log('membership-lifecycle completed:', result)
      return json(result)
    }

    const publishableKey = envKey('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_ANON_KEY')
    if (!publishableKey) throw new HttpError('Function is not configured', 500)
    const authClient = createClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: { user }, error: authError } = await authClient.auth.getUser(token)
    if (authError || !user) throw new HttpError('Sign in required', 401)
    const gymId = String(body.gymId ?? '')
    const [{ data: actor }, { data: profile }, { data: gym }] = await Promise.all([
      admin.from('gym_members').select('id,role').eq('gym_id', gymId).eq('profile_id', user.id).eq('is_active', true).maybeSingle(),
      admin.from('profiles').select('is_super_admin').eq('id', user.id).maybeSingle(),
      admin.from('gyms').select('is_active').eq('id', gymId).maybeSingle(),
    ])
    if (!gym?.is_active) throw new HttpError('Gym is inactive', 403)
    if (!profile?.is_super_admin && (!actor || !['owner', 'admin'].includes(actor.role))) throw new HttpError('You do not have permission to manage memberships', 403)
    const actorId = actor?.id
    if (!actorId) throw new HttpError('A gym staff account is required', 403)

    let result: unknown
    if (body.action === 'create') result = await createMembership(admin, actorId, body)
    else if (body.action === 'freeze') result = await freezeMembership(admin, actorId, body)
    else if (body.action === 'resume') result = await resumeMembership(admin, actorId, body)
    else if (body.action === 'extend') result = await extendMembership(admin, actorId, body)
    else if (body.action === 'cancel') result = await cancelMembership(admin, actorId, body)
    else throw new HttpError('Unknown membership action')
    return json({ success: true, result })
  } catch (error) {
    console.error(error)
    const status = error instanceof HttpError ? error.status : 500
    return json({ error: error instanceof Error ? error.message : 'Membership action failed' }, status)
  }
})
