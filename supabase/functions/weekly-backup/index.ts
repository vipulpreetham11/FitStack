import { createClient } from 'npm:@supabase/supabase-js@2.109.0'
import { envKey, HttpError, json } from '../_shared/fitstack.ts'

const TABLES = ['gyms', 'profiles', 'gym_members', 'membership_plans', 'promo_codes', 'payments', 'memberships', 'membership_freezes', 'membership_events', 'invoices', 'razorpay_webhook_events', 'credit_notes', 'access_devices', 'attendance', 'scan_events', 'gym_holidays'] as const
const encoder = new TextEncoder()
const hex = (bytes: Uint8Array) => [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('')
async function sha256(value: string) { return new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))) }
async function hmac(key: Uint8Array, value: string) { const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); return new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(value))) }
function safeEqual(left: string, right: string) { if (left.length !== right.length) return false; let difference = 0; for (let index = 0; index < left.length; index++) difference |= left.charCodeAt(index) ^ right.charCodeAt(index); return difference === 0 }

async function fetchTable(admin: ReturnType<typeof createClient>, table: string) {
  const rows: unknown[] = []; const pageSize = 1000
  for (let from = 0; ; from += pageSize) { const { data, error } = await admin.from(table).select('*').range(from, from + pageSize - 1); if (error) throw error; rows.push(...(data ?? [])); if (!data || data.length < pageSize) return rows }
}

async function uploadR2(body: string, objectKey: string, config: { account: string; access: string; secret: string; bucket: string }) {
  const now = new Date(); const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, ''); const date = amzDate.slice(0, 8); const region = 'auto'; const service = 's3'
  const host = `${config.account}.r2.cloudflarestorage.com`; const encodedKey = objectKey.split('/').map(encodeURIComponent).join('/'); const canonicalUri = `/${encodeURIComponent(config.bucket)}/${encodedKey}`; const payloadHash = hex(await sha256(body)); const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date'
  const canonicalHeaders = `content-type:application/json\nhost:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`; const canonicalRequest = `PUT\n${canonicalUri}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`; const scope = `${date}/${region}/${service}/aws4_request`; const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${hex(await sha256(canonicalRequest))}`
  const dateKey = await hmac(encoder.encode(`AWS4${config.secret}`), date); const regionKey = await hmac(dateKey, region); const serviceKey = await hmac(regionKey, service); const signingKey = await hmac(serviceKey, 'aws4_request'); const signature = hex(await hmac(signingKey, stringToSign))
  const response = await fetch(`https://${host}${canonicalUri}`, { method: 'PUT', headers: { 'content-type': 'application/json', 'x-amz-content-sha256': payloadHash, 'x-amz-date': amzDate, Authorization: `AWS4-HMAC-SHA256 Credential=${config.access}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}` }, body })
  if (!response.ok) throw new HttpError(`R2 upload failed (${response.status})`, 502)
}

Deno.serve(async req => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, false)
  try {
    const expected = Deno.env.get('BACKUP_CRON_SECRET') ?? ''; const received = req.headers.get('x-backup-secret') ?? ''
    if (!expected || !safeEqual(expected, received)) throw new HttpError('Unauthorized', 401)
    const url = Deno.env.get('SUPABASE_URL') ?? ''; const secretKey = envKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY')
    if (!url || !secretKey) throw new HttpError('Function is not configured', 500)
    const admin = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } }); const entries = await Promise.all(TABLES.map(async table => [table, await fetchTable(admin, table)] as const)); const snapshot = Object.fromEntries(entries); const createdAt = new Date().toISOString(); const body = JSON.stringify({ version: 1, created_at: createdAt, tables: snapshot })
    const config = { account: Deno.env.get('R2_ACCOUNT_ID') ?? '', access: Deno.env.get('R2_ACCESS_KEY_ID') ?? '', secret: Deno.env.get('R2_SECRET_ACCESS_KEY') ?? '', bucket: Deno.env.get('R2_BUCKET') ?? '' }
    if (!config.account || !config.access || !config.secret || !config.bucket) { console.log('R2 not configured; backup dry run complete', Object.fromEntries(entries.map(([table, rows]) => [table, rows.length]))); return json({ success: true, simulated: true, createdAt, tables: entries.length }, 200, false) }
    const objectKey = `fitstack/${createdAt.slice(0, 10)}/backup-${createdAt.replaceAll(':', '-')}.json`; await uploadR2(body, objectKey, config)
    return json({ success: true, simulated: false, createdAt, objectKey, tables: entries.length }, 200, false)
  } catch (error) { console.error(error); const status = error instanceof HttpError ? error.status : 500; return json({ error: status >= 500 ? 'Backup failed' : error instanceof Error ? error.message : 'Backup failed' }, status, false) }
})
