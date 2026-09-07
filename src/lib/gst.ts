/** Display estimate. Checkout always recalculates amounts on the server. */
export function calculateGST(basePrice: number, discountAmount: number, gstRate = 5) {
  if (![basePrice, discountAmount, gstRate].every(Number.isFinite) || basePrice < 0 || discountAmount < 0 || discountAmount > basePrice || gstRate < 0 || gstRate > 100) throw new RangeError('Invalid price, discount, or GST rate')
  const base = Math.round((basePrice + Number.EPSILON) * 100)
  const discount = Math.round((discountAmount + Number.EPSILON) * 100)
  const taxable = base - discount
  const halfTax = Math.round(taxable * gstRate / 200)
  return { taxableAmount: taxable / 100, cgstAmount: halfTax / 100, sgstAmount: halfTax / 100, totalAmount: (taxable + halfTax * 2) / 100 }
}
