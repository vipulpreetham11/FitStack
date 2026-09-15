import { authenticatedAdmin, corsHeaders, HttpError, json } from '../_shared/fitstack.ts'

const STAFF_ROLES = ['owner', 'admin', 'receptionist']
const ELIGIBLE_MEMBERSHIP_STATUSES = ['active', 'frozen']
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function hexToBytes(hex: string): Uint8Array {
  if (!/^[0-9a-f]{64}$/i.test(hex)) throw new HttpError('QR secret is invalid', 500)
  const bytes = new Uint8Array(hex.length / 2)
  for (let index = 0; index < hex.length; index += 2) {
    bytes[index / 2] = Number.parseInt(hex.slice(index, index + 2), 16)
  }
  return bytes
}

async function hmacSha1(secretHex: string, memberId: string, timeWindow: number): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    hexToBytes(secretHex),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  )
  const message = new TextEncoder().encode(`${memberId}${timeWindow}`)
  const digest = new Uint8Array(await crypto.subtle.sign('HMAC', key, message))
  return [...digest].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false
  let difference = 0
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }
  return difference === 0
}

function parseQrData(qrData: string) {
  const parts = qrData.split(':')
  if (
    parts.length !== 4 ||
    parts[0] !== 'fitstack' ||
    !UUID_PATTERN.test(parts[1]) ||
    !UUID_PATTERN.test(parts[2]) ||
    !/^[0-9a-f]{40}$/i.test(parts[3])
  ) return null
  return { gymId: parts[1], memberId: parts[2], token: parts[3].toLowerCase() }
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const { user, admin } = await authenticatedAdmin(req)
    const body = await req.json() as { qr_data?: unknown; gym_id?: unknown; device_id?: unknown }
    const qrData = typeof body.qr_data === 'string' ? body.qr_data.trim() : ''
    const gymId = typeof body.gym_id === 'string' ? body.gym_id.trim() : ''
    const deviceId = typeof body.device_id === 'string' && body.device_id.trim() ? body.device_id.trim() : null
    if (!qrData || !gymId) throw new HttpError('qr_data and gym_id are required')
    if (!UUID_PATTERN.test(gymId)) throw new HttpError('gym_id is invalid')

    const { data: actor, error: actorError } = await admin
      .from('gym_members')
      .select('id, role')
      .eq('gym_id', gymId)
      .eq('profile_id', user.id)
      .eq('is_active', true)
      .in('role', STAFF_ROLES)
      .maybeSingle()
    if (actorError) throw actorError
    if (!actor) throw new HttpError('You do not have permission to scan', 403)

    const parsed = parseQrData(qrData)
    if (!parsed || parsed.gymId !== gymId) {
      const { error: scanError } = await admin.from('scan_events').insert({
        gym_id: gymId,
        member_id: null,
        scanned_at: new Date().toISOString(),
        result: 'denied',
        denial_reason: 'invalid_token',
        device_id: deviceId,
        raw_qr_data: qrData,
      })
      if (scanError) throw scanError
      return json({ result: 'denied', reason: 'Invalid QR code' })
    }

    const { data: member, error: memberError } = await admin
      .from('gym_members')
      .select('id, qr_secret, is_active, profile_id')
      .eq('id', parsed.memberId)
      .eq('gym_id', gymId)
      .maybeSingle()
    if (memberError) throw memberError
    if (!member) {
      const { error: scanError } = await admin.from('scan_events').insert({
        gym_id: gymId,
        member_id: null,
        scanned_at: new Date().toISOString(),
        result: 'denied',
        denial_reason: 'invalid_token',
        device_id: deviceId,
        raw_qr_data: qrData,
      })
      if (scanError) throw scanError
      return json({ result: 'denied', reason: 'Invalid QR code' })
    }

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('full_name')
      .eq('id', member.profile_id)
      .maybeSingle()
    if (profileError) throw profileError
    const memberName = (profile?.full_name as string | null) ?? 'Member'
    const scannedAt = new Date().toISOString()

    const deny = async (denialReason: string, reason: string) => {
      const { error } = await admin.from('scan_events').insert({
        gym_id: gymId,
        member_id: member.id,
        scanned_at: scannedAt,
        result: 'denied',
        denial_reason: denialReason,
        device_id: deviceId,
        raw_qr_data: qrData,
      })
      if (error) throw error
      return json({ result: 'denied', reason, member_name: memberName })
    }

    if (!member.qr_secret) return await deny('invalid_token', 'Invalid QR code')

    const currentWindow = Math.floor(Date.now() / 60_000)
    const [currentToken, previousToken] = await Promise.all([
      hmacSha1(member.qr_secret as string, member.id as string, currentWindow),
      hmacSha1(member.qr_secret as string, member.id as string, currentWindow - 1),
    ])
    if (!constantTimeEqual(parsed.token, currentToken) && !constantTimeEqual(parsed.token, previousToken)) {
      return await deny('invalid_token', 'Invalid QR code')
    }

    if (!member.is_active) return await deny('no_active_membership', 'No active membership')

    const { data: membership, error: membershipError } = await admin
      .from('memberships')
      .select('id')
      .eq('gym_id', gymId)
      .eq('member_id', member.id)
      .in('status', ELIGIBLE_MEMBERSHIP_STATUSES)
      .limit(1)
      .maybeSingle()
    if (membershipError) throw membershipError
    if (!membership) return await deny('no_active_membership', 'No active membership')

    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
    const { data: recentCheckin, error: cooldownError } = await admin
      .from('attendance')
      .select('id')
      .eq('gym_id', gymId)
      .eq('member_id', member.id)
      .gte('check_in_at', fourHoursAgo)
      .order('check_in_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (cooldownError) throw cooldownError
    if (recentCheckin) return await deny('cooldown', 'Already checked in recently')

    const checkInAt = new Date().toISOString()
    const { error: attendanceError } = await admin.from('attendance').insert({
      gym_id: gymId,
      member_id: member.id,
      check_in_at: checkInAt,
      method: 'qr',
      device_id: deviceId,
    })
    if (attendanceError) throw attendanceError

    const { error: scanEventError } = await admin.from('scan_events').insert({
      gym_id: gymId,
      member_id: member.id,
      scanned_at: checkInAt,
      result: 'allowed',
      device_id: deviceId,
      raw_qr_data: qrData,
    })
    if (scanEventError) throw scanEventError

    return json({ result: 'allowed', member_name: memberName })
  } catch (error) {
    console.error(error)
    const status = error instanceof HttpError ? error.status : 500
    return json({ error: error instanceof Error ? error.message : 'Check-in failed' }, status)
  }
})
