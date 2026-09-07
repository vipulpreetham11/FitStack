import { authenticatedAdmin, corsHeaders, HttpError, json } from '../_shared/fitstack.ts'

async function hmacHex(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const digest = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(message)))
  return [...digest].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  try {
    const { user, admin } = await authenticatedAdmin(req)
    const body = await req.json() as { token?: string; device_id?: string }
    const token = String(body.token ?? '').trim()
    if (!token) throw new HttpError('token is required')
    const parts = token.split(':')
    if (parts.length < 4) throw new HttpError('Invalid QR token format')
    const isDevMode = parts.length === 4 && parts[3] === 'dev-mode'
    const gymId = parts[0]
    const memberId = parts[1]
    const timestamp = parseInt(parts[2], 10)
    const receivedHmac = parts.slice(3).join(':')
    if (!gymId || !memberId || !Number.isInteger(timestamp)) throw new HttpError('Invalid QR token format')
    const now = Math.floor(Date.now() / 1000)
    if (!isDevMode && (now - timestamp > 60 || timestamp > now + 5)) {
      throw new HttpError('QR code has expired. Ask the member to refresh their QR code.')
    }
    const { data: actor, error: actorError } = await admin
      .from('gym_members').select('id, role')
      .eq('gym_id', gymId).eq('profile_id', user.id).eq('is_active', true).maybeSingle()
    if (actorError) throw actorError
    if (!actor) throw new HttpError('You do not have access to this gym', 403)
    const canScan = ['owner', 'admin', 'receptionist', 'trainer'].includes(actor.role as string)
    if (!canScan) throw new HttpError('You do not have permission to scan', 403)
    const { data: member, error: memberError } = await admin
      .from('gym_members').select('id, qr_secret, is_active, profile_id')
      .eq('id', memberId).eq('gym_id', gymId).maybeSingle()
    if (memberError) throw memberError
    if (!member) throw new HttpError('Member not found')
    if (!isDevMode) {
      const message = `${gymId}:${memberId}:${timestamp}`
      const expectedHmac = await hmacHex(member.qr_secret as string, message)
      if (!constantTimeEqual(expectedHmac, receivedHmac)) throw new HttpError('QR code signature is invalid')
    }
    const { data: profile } = await admin.from('profiles')
      .select('full_name, avatar_url, phone').eq('id', member.profile_id).single()
    const { data: memberships } = await admin.from('memberships')
      .select('id, status, end_date, plan_id').eq('gym_id', gymId).eq('member_id', memberId)
      .in('status', ['active', 'frozen']).order('end_date', { ascending: false }).limit(1)
    const activeMembership = memberships?.[0] ?? null
    let planName = 'Unknown Plan'
    if (activeMembership?.plan_id) {
      const { data: plan } = await admin.from('membership_plans').select('name').eq('id', activeMembership.plan_id).single()
      if (plan) planName = plan.name as string
    }
    const memberInfo = {
      id: memberId, name: profile?.full_name ?? 'Unknown',
      avatar_url: profile?.avatar_url ?? null, phone: profile?.phone ?? null,
      plan_name: planName, membership_status: activeMembership?.status ?? 'none',
      end_date: activeMembership?.end_date ?? null,
    }
    if (!member.is_active) {
      await admin.from('scan_events').insert({ gym_id: gymId, member_id: memberId, scanned_by: actor.id, result: 'denied', denial_reason: 'Member account is inactive', device_id: body.device_id ?? null })
      return json({ allowed: false, reason: 'Member account is inactive', member: memberInfo })
    }
    if (!activeMembership || activeMembership.status === 'frozen') {
      const reason = !activeMembership ? 'No active membership' : 'Membership is frozen'
      await admin.from('scan_events').insert({ gym_id: gymId, member_id: memberId, scanned_by: actor.id, result: 'denied', denial_reason: reason, device_id: body.device_id ?? null })
      return json({ allowed: false, reason, member: memberInfo })
    }
    const sixtySecsAgo = new Date(Date.now() - 60000).toISOString()
    const { data: recentScan } = await admin.from('attendance').select('id')
      .eq('gym_id', gymId).eq('member_id', memberId).gte('check_in_at', sixtySecsAgo).limit(1)
    if (recentScan && recentScan.length > 0) return json({ allowed: false, reason: 'Already checked in within the last 60 seconds', member: memberInfo })
    const fourHoursAgo = new Date(Date.now() - 4 * 3600000).toISOString()
    const { data: recentCheckin } = await admin.from('attendance').select('id')
      .eq('gym_id', gymId).eq('member_id', memberId).gte('check_in_at', fourHoursAgo).limit(1)
    if (recentCheckin && recentCheckin.length > 0) return json({ allowed: false, reason: 'Already checked in within the last 4 hours', member: memberInfo })
    const { error: attError } = await admin.from('attendance').insert({ gym_id: gymId, member_id: memberId, method: 'qr',  })
    if (attError) throw attError
    await admin.from('scan_events').insert({ gym_id: gymId, member_id: memberId, scanned_by: actor.id, result: 'allowed', device_id: body.device_id ?? null })
    return json({ allowed: true, member: memberInfo, devMode: isDevMode })
  } catch (error) {
    console.error(error)
    const status = error instanceof HttpError ? error.status : 500
    return json({ error: error instanceof Error ? error.message : 'Check-in failed' }, status)
  }
})

