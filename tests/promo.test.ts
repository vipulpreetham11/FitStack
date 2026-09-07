import { describe, expect, it } from 'vitest'
import { calculatePromoDiscount } from '../src/lib/promo'

describe('promo discount calculation', () => {
  it('applies percentage discounts', () => {
    expect(calculatePromoDiscount({ discount_type: 'percentage', discount_value: 50, max_discount_amount: null }, 5000)).toBe(2500)
  })

  it('caps percentage discounts', () => {
    expect(calculatePromoDiscount({ discount_type: 'percentage', discount_value: 50, max_discount_amount: 500 }, 5000)).toBe(500)
  })

  it('applies flat discounts without exceeding the plan price', () => {
    expect(calculatePromoDiscount({ discount_type: 'flat', discount_value: 400, max_discount_amount: null }, 1000)).toBe(400)
    expect(calculatePromoDiscount({ discount_type: 'flat', discount_value: 1500, max_discount_amount: null }, 1000)).toBe(1000)
  })

  it('rounds to paise', () => {
    expect(calculatePromoDiscount({ discount_type: 'percentage', discount_value: 33.33, max_discount_amount: null }, 99.99)).toBe(33.33)
  })
})
