import { describe, expect, it } from 'vitest'
import { addDays, calculateMembershipEndDate, daysBetween, membershipProgress } from '../src/lib/membership'

describe('membership date calculations', () => {
  it('calculates inclusive day durations', () => {
    expect(calculateMembershipEndDate('2026-09-01', 'days', 100)).toBe('2026-12-09')
  })

  it('calculates inclusive month durations', () => {
    expect(calculateMembershipEndDate('2026-09-01', 'months', 1)).toBe('2026-09-30')
    expect(calculateMembershipEndDate('2026-01-31', 'months', 1)).toBe('2026-02-27')
  })

  it('calculates inclusive year durations', () => {
    expect(calculateMembershipEndDate('2026-01-01', 'years', 1)).toBe('2026-12-31')
  })

  it('supports freeze extensions and early-resume reclamation', () => {
    const extended = addDays('2026-10-07', 14)
    expect(extended).toBe('2026-10-21')
    expect(addDays(extended, -(14 - 7))).toBe('2026-10-14')
    expect(daysBetween('2026-09-15', '2026-09-22')).toBe(7)
  })

  it('calculates bounded progress', () => {
    expect(membershipProgress('2026-09-01', '2026-09-30', '2026-09-15')).toBe(50)
    expect(membershipProgress('2026-09-01', '2026-09-30', '2026-10-10')).toBe(100)
  })
})
