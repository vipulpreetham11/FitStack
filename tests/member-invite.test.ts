import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const createMemberPage = readFileSync(
  new URL('../src/pages/admin/members/CreateMemberPage.tsx', import.meta.url),
  'utf8',
)

describe('admin member invite handoff', () => {
  it('shows the production join link after member creation and makes it copyable', () => {
    expect(createMemberPage).toContain('https://fitstack.pages.dev/join/afterburn')
    expect(createMemberPage).toContain(
      'Share this link with the member to let them set up their account.',
    )
    expect(createMemberPage).toContain('navigator.clipboard.writeText(MEMBER_INVITE_LINK)')
  })

  it('does not expose an admin auth call or create a QR secret in the browser', () => {
    expect(createMemberPage).not.toContain('auth.admin.inviteUserByEmail')
    expect(createMemberPage).not.toMatch(/qr_secret\s*:/)
  })
})
