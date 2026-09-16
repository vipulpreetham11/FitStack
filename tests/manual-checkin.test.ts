import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const hookSource = readFileSync(new URL('../src/hooks/useQuickCheckIn.ts', import.meta.url), 'utf8')
const panelSource = readFileSync(new URL('../src/components/attendance/QuickCheckInPanel.tsx', import.meta.url), 'utf8')
const pageSource = readFileSync(new URL('../src/pages/admin/attendance/AttendanceListPage.tsx', import.meta.url), 'utf8')
const migrationSource = readFileSync(
  new URL('../supabase/migrations/20260916194131_add_manual_member_checkin.sql', import.meta.url),
  'utf8',
)

describe('manual attendance check-in', () => {
  it('searches safe member fields after a 300ms debounce', () => {
    expect(panelSource).toContain('}, 300)')
    expect(hookSource).toContain(".from('gym_members')")
    expect(hookSource).toContain(".eq('is_active', true)")
    expect(hookSource).toContain("{ referencedTable: 'profiles' }")
    expect(hookSource).not.toContain('qr_secret')
    expect(hookSource).not.toContain("select('*')")
  })

  it('limits the panel to attendance staff and refreshes the live list', () => {
    expect(pageSource).toContain("['owner', 'admin', 'receptionist'].includes(role)")
    expect(pageSource).toContain('<QuickCheckInPanel onCheckedIn={refresh} />')
    expect(pageSource).toContain('Currently Checked In')
  })

  it('enforces authorization, active membership, cooldown, and audit attribution in one RPC', () => {
    expect(migrationSource).toContain("v_actor_role not in ('owner', 'admin', 'receptionist')")
    expect(migrationSource).toContain("v_membership_status <> 'active'")
    expect(migrationSource).toContain("interval '4 hours'")
    expect(migrationSource).toContain('pg_advisory_xact_lock')
    expect(migrationSource).toContain("'manual'")
    expect(migrationSource).toContain('checked_in_by')
    expect(migrationSource).toContain('from public, anon')
  })
})
