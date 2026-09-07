import { describe, expect, it } from 'vitest'
import { reportRange } from '../src/lib/reports'
import { toDateOnly } from '../src/lib/membership'

describe('report ranges', () => {
  it('uses the current calendar month in India', () => {
    const today = toDateOnly()
    expect(reportRange('month')).toEqual({ from: `${today.slice(0, 7)}-01`, to: today })
  })

  it('preserves a valid custom range', () => {
    expect(reportRange('custom', { from: '2026-01-05', to: '2026-02-07' })).toEqual({ from: '2026-01-05', to: '2026-02-07' })
  })

  it('starts a quarter on January, April, July, or October', () => {
    expect(['01', '04', '07', '10']).toContain(reportRange('quarter').from.slice(5, 7))
  })
})
