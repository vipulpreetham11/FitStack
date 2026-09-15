import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const paymentSettingsPage = readFileSync(
  new URL('../src/pages/admin/settings/PaymentSettingsPage.tsx', import.meta.url),
  'utf8',
)

describe('payment settings credential save', () => {
  it('uses the authorized Edge Function with the deployed request contract', () => {
    expect(paymentSettingsPage).toContain("functions.invoke('save-razorpay-credentials'")
    expect(paymentSettingsPage).toContain('{ gym_id: gym.gym_id }')
    expect(paymentSettingsPage).toContain('if (keyId) body.key_id = keyId')
    expect(paymentSettingsPage).toContain('if (keySecret) body.key_secret = keySecret')
    expect(paymentSettingsPage).toContain('if (webhookSecret) body.webhook_secret = webhookSecret')
    expect(paymentSettingsPage).not.toContain("supabase.rpc('save_razorpay_credentials'")
  })

  it('does not update protected gym credential columns directly', () => {
    expect(paymentSettingsPage).not.toContain(".from('gyms')")
    expect(paymentSettingsPage).not.toContain('.update({')
  })
})
