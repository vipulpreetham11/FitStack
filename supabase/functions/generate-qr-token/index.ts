import { authenticatedAdmin, corsHeaders, HttpError, json } from '../_shared/fitstack.ts'

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

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const { user, admin } = await authenticatedAdmin(req)
    const body = await req.json() as { gym_id?: unknown }
    const gymId = typeof body.gym_id === 'string' ? body.gym_id.trim() : ''
    if (!gymId) throw new HttpError('gym_id is required')

    const { data: member, error: memberError } = await admin
      .from('gym_members')
      .select('id, gym_id, qr_secret')
      .eq('gym_id', gymId)
      .eq('profile_id', user.id)
      .eq('is_active', true)
      .maybeSingle()
    if (memberError) throw memberError
    if (!member) throw new HttpError('Active gym member not found', 404)
    if (!member.qr_secret) throw new HttpError('QR secret is not configured', 500)

    const now = Date.now()
    const timeWindow = Math.floor(now / 60_000)
    const token = await hmacSha1(member.qr_secret as string, member.id as string, timeWindow)
    const expiresIn = Math.max(1, Math.ceil(((timeWindow + 1) * 60_000 - now) / 1000))

    return json({
      token,
      member_id: member.id,
      gym_id: member.gym_id,
      expires_in: expiresIn,
    })
  } catch (error) {
    console.error(error)
    const status = error instanceof HttpError ? error.status : 500
    return json({ error: error instanceof Error ? error.message : 'Could not generate QR token' }, status)
  }
})
