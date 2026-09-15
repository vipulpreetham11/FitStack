import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const memberQrPage = readFileSync(new URL('../src/pages/member/MemberQRPage.tsx', import.meta.url), 'utf8')
const scannerPage = readFileSync(new URL('../src/pages/admin/attendance/ScannerPage.tsx', import.meta.url), 'utf8')
const generateFunction = readFileSync(new URL('../supabase/functions/generate-qr-token/index.ts', import.meta.url), 'utf8')
const verifyFunction = readFileSync(new URL('../supabase/functions/verify-qr-checkin/index.ts', import.meta.url), 'utf8')
const functionConfig = readFileSync(new URL('../supabase/config.toml', import.meta.url), 'utf8')

describe('production QR attendance contract', () => {
  it('encodes the complete Edge Function response and refreshes from expires_in', () => {
    expect(memberQrPage).toContain("functions.invoke('generate-qr-token'")
    expect(memberQrPage).toContain('body: { gym_id: gym.gym_id }')
    expect(memberQrPage).toContain('fitstack:${response.gym_id}:${response.member_id}:${response.token}')
    expect(memberQrPage).toContain('response.expires_in')
    expect(memberQrPage).not.toMatch(/dev.?mode|devToken/i)
  })

  it('submits the raw QR payload and handles allowed and denied results', () => {
    expect(scannerPage).toContain("functions.invoke('verify-qr-checkin'")
    expect(scannerPage).toContain('qr_data: scannedQrString')
    expect(scannerPage).toContain('gym_id: gym.gym_id')
    expect(scannerPage).toContain('device_id: null')
    expect(scannerPage).toContain("response.result !== 'allowed'")
    expect(scannerPage).toContain("response.result !== 'denied'")
    expect(scannerPage).not.toMatch(/dev.?mode|devToken|manualCode/i)
  })

  it('uses signed 60-second SHA-1 windows without a development bypass', () => {
    expect(generateFunction).toContain("hash: 'SHA-1'")
    expect(generateFunction).toContain('Math.floor(now / 60_000)')
    expect(verifyFunction).toContain("hash: 'SHA-1'")
    expect(verifyFunction).toContain('currentWindow - 1')
    expect(verifyFunction).toContain('4 * 60 * 60 * 1000')
    expect(verifyFunction).not.toMatch(/dev.?mode|isDevMode|trainer/i)
  })

  it('keeps JWT verification enabled for both QR functions', () => {
    expect(functionConfig).toMatch(/\[functions\.generate-qr-token\]\s+verify_jwt = true/)
    expect(functionConfig).toMatch(/\[functions\.verify-qr-checkin\]\s+verify_jwt = true/)
  })
})
