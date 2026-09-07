import { authenticatedAdmin, corsHeaders, HttpError, json, type JsonRecord } from '../_shared/fitstack.ts'

const text = (value: unknown) => String(value ?? '').trim()
function phone(value: unknown) { const digits = text(value).replace(/\D/g, '').replace(/^91(?=[6-9]\d{9}$)/, ''); if (!/^[6-9]\d{9}$/.test(digits)) throw new HttpError('Enter a valid owner phone number'); return `+91${digits}` }

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  try {
    const { user, admin } = await authenticatedAdmin(req); const { data: actor } = await admin.from('profiles').select('is_super_admin').eq('id', user.id).single()
    if (!actor?.is_super_admin) throw new HttpError('Super admin access required', 403)
    const body = await req.json() as JsonRecord; const name = text(body.name); const slug = text(body.slug).toLowerCase(); const ownerName = text(body.owner_name); const ownerPhone = phone(body.owner_phone)
    if (name.length < 2 || ownerName.length < 2) throw new HttpError('Gym and owner names are required')
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new HttpError('Choose a valid gym slug')
    let profileId: string | null = null; let createdUser = false
    const { data: existingProfile, error: profileLookupError } = await admin.from('profiles').select('id').eq('phone', ownerPhone).maybeSingle(); if (profileLookupError) throw profileLookupError; profileId = existingProfile?.id ?? null
    if (!profileId) {
      for (let page = 1; page <= 10 && !profileId; page++) { const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 }); if (error) throw error; profileId = data.users.find(candidate => candidate.phone === ownerPhone)?.id ?? null; if (data.users.length < 1000) break }
    }
    if (!profileId) { const { data, error } = await admin.auth.admin.createUser({ phone: ownerPhone, phone_confirm: true, user_metadata: { full_name: ownerName } }); if (error || !data.user) throw error ?? new Error('Could not create owner'); profileId = data.user.id; createdUser = true }
    const { error: profileError } = await admin.from('profiles').upsert({ id: profileId, phone: ownerPhone, full_name: ownerName }, { onConflict: 'id' }); if (profileError) { if (createdUser) await admin.auth.admin.deleteUser(profileId); throw profileError }
    const { data: gym, error: gymError } = await admin.from('gyms').insert({ name, slug, city: text(body.city) || null, state: text(body.state) || null, address: text(body.address) || null, pincode: text(body.pincode) || null, phone: text(body.phone) || null, email: text(body.email) || null, brand_color: text(body.brand_color) || '#171717', brand_color_secondary: text(body.brand_color_secondary) || null, logo_url: text(body.logo_url) || null, gstin: text(body.gstin) || null, business_hours: body.business_hours ?? { open: '06:00', close: '22:00' }, working_days: body.working_days ?? [1,2,3,4,5,6], invoice_prefix: text(body.invoice_prefix) || 'INV', razorpay_key_id_enc: text(body.razorpay_key_id) || null, razorpay_key_secret_enc: text(body.razorpay_key_secret) || null, razorpay_webhook_secret_enc: text(body.razorpay_webhook_secret) || null, is_active: true }).select('id').single()
    if (gymError) { if (createdUser) await admin.auth.admin.deleteUser(profileId); throw gymError }
    const { error: memberError } = await admin.from('gym_members').insert({ gym_id: gym.id, profile_id: profileId, role: 'owner', is_active: true }); if (memberError) { await admin.from('gyms').delete().eq('id', gym.id); if (createdUser) await admin.auth.admin.deleteUser(profileId); throw memberError }
    return json({ success: true, gymId: gym.id })
  } catch (error) { console.error(error); const status = error instanceof HttpError ? error.status : 500; return json({ error: error instanceof Error ? error.message : 'Could not create gym' }, status) }
})
