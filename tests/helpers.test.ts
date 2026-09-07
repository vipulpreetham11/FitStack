import { describe,it,expect } from 'vitest'
import { formatDate,formatDateTime,formatCurrency,formatPhone,parsePhone,normalizePhone } from '../src/lib/format'
import { calculateGST } from '../src/lib/gst'
import { safeExportRows } from '../src/lib/export'
import { hasPermission } from '../src/lib/constants'
describe('Indian business helpers',()=>{
 it('formats IST dates across UTC day boundary',()=>{expect(formatDate('2026-09-05T20:00:00Z')).toBe('06 Sep 2026'); expect(formatDateTime('2026-09-06T09:00:00Z')).toBe('06 Sep 2026, 02:30 PM')})
 it('preserves date-only values and lakh grouping',()=>{expect(formatDate('2026-09-06')).toBe('06 Sep 2026');expect(formatCurrency(125000)).toBe('₹1,25,000.00')})
 it('normalizes phones without confusing storage and display',()=>{expect(parsePhone('+91 98765 43210')).toBe('9876543210');expect(normalizePhone('9876543210')).toBe('+919876543210');expect(formatPhone('+919876543210')).toBe('+91 98765 43210');expect(()=>parsePhone('123')).toThrow()})
 it('discounts before GST and handles free/non-GST sales',()=>{expect(calculateGST(5000,2500)).toEqual({taxableAmount:2500,cgstAmount:62.5,sgstAmount:62.5,totalAmount:2625});expect(calculateGST(5000,5000).totalAmount).toBe(0);expect(calculateGST(5000,500,0).totalAmount).toBe(4500);expect(()=>calculateGST(10,11)).toThrow()})
 it('keeps permissions explicit',()=>{expect(hasPermission('admin','credentials.manage')).toBe(false);expect(hasPermission('owner','credentials.manage')).toBe(true);expect(hasPermission('trainer','payments.view')).toBe(false);expect(hasPermission('receptionist','reports.view')).toBe(false)})
 it('neutralizes spreadsheet formula injection',()=>{expect(safeExportRows([{name:'=CMD()',value:42}])).toEqual([{name:"'=CMD()",value:42}])})
})
