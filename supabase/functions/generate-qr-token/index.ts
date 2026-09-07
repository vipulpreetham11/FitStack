import { authenticatedAdmin, corsHeaders, HttpError, json } from '../_shared/fitstack.ts'

async function hmacHex(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const digest = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(message)))
  return [...digest].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  try {
    const { user, admin } = await authenticatedAdmin(req)
    const body = await req.json() as { gym_id?: string }
    const gymId = String(body.gym_id ?? '').trim()
    if (!gymId) throw new HttpError('gym_id is required')
    const { data: member, error: memberError } = await admin
      .from('gym_members')
      .select('id, qr_secret, is_active')
      .eq('gym_id', gymId)
      .eq('profile_id', user.id)
      .eq('is_active', true)
      .maybeSingle()
    if (memberError) throw memberError
    if (!member) throw new HttpError('Member not found in this gym', 404)
    if (!member.qr_secret) throw new HttpError('QR secret not set for this member', 500)
    const timestamp = Math.floor(Date.now() / 1000)
    const message = `${gymId}:${member.id}:${timestamp}`
    const hmac = await hmacHex(member.qr_secret as string, message)
    const token = `${gymId}:${member.id}:${timestamp}:${hmac}`
    return json({ token, expiresAt: timestamp + 60 })
  } catch (error) {
    console.error(error)
    const status = error instanceof HttpError ? error.status : 500
    return json({ error: error instanceof Error ? error.message : 'Could not generate QR token' }, status)
  }
})
