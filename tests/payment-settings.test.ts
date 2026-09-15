import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const paymentSettingsPage = readFileSync(
  new URL('../src/pages/admin/settings/PaymentSettingsPage.tsx', import.meta.url),
  'utf8',
)

describe('payment settings credential save', () => {
  it('uses the authorized RPC with the deployed parameter contract', () => {
    expect(paymentSettingsPage).toContain("supabase.rpc('save_razorpay_credentials'")
    expect(paymentSettingsPage).toContain('p_gym_id: gym.gym_id')
    expect(paymentSettingsPage).toContain('p_key_id: data.razorpay_key_id || null')
    expect(paymentSettingsPage).toContain('p_key_secret: data.razorpay_key_secret || null')
    expect(paymentSettingsPage).toContain(
      'p_webhook_secret: data.razorpay_webhook_secret || null',
    )
  })

  it('does not update protected gym credential columns directly', () => {
    expect(paymentSettingsPage).not.toContain(".from('gyms')")
    expect(paymentSettingsPage).not.toContain('.update({')
  })
})
