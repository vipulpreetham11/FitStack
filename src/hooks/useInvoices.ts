import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useGym } from '@/hooks/useGym'
import { exportData } from '@/lib/export'
import type { Database, Json } from '@/types/database'

type InvoiceRow = Database['public']['Tables']['invoices']['Row']
export type Invoice = InvoiceRow & { payment: { status: string } | null }
export type InvoiceItem = { description: string; sac_code?: string; qty: number; rate: number; amount: number }

function normalizeInvoice(row: any): Invoice {
  return {
    ...row,
    payment: Array.isArray(row.payment) ? row.payment[0] ?? null : row.payment ?? null,
  } as Invoice
}

export function invoiceItems(value: Json): InvoiceItem[] {
  if (!Array.isArray(value)) return []
  return value.flatMap(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return []
    const record = item as Record<string, Json | undefined>
    return [{ description: String(record.description ?? 'Membership'), sac_code: record.sac_code ? String(record.sac_code) : undefined, qty: Number(record.qty ?? 1), rate: Number(record.rate ?? 0), amount: Number(record.amount ?? 0) }]
  })
}

export function useInvoices() {
  const { gym } = useGym()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!gym || !supabase) { setInvoices([]); setLoading(false); return }
    setLoading(true); setError(null)
    const { data, error: queryError } = await (supabase as any).from('invoices').select('*, payment:payments!invoices_payment_id_fkey(status)').eq('gym_id', gym.gym_id).order('invoice_date', { ascending: false }).order('created_at', { ascending: false })
    if (queryError) setError(queryError.message)
    else setInvoices((data ?? []).map(normalizeInvoice))
    setLoading(false)
  }, [gym])

  useEffect(() => { void refresh() }, [refresh])

  const getInvoice = useCallback(async (id: string) => {
    if (!gym || !supabase) throw new Error('Supabase is not configured')
    const { data, error: queryError } = await (supabase as any).from('invoices').select('*, payment:payments!invoices_payment_id_fkey(status)').eq('id', id).eq('gym_id', gym.gym_id).single()
    if (queryError) throw queryError
    return normalizeInvoice(data)
  }, [gym])

  const getInvoiceByPayment = useCallback(async (paymentId: string) => {
    if (!gym || !supabase) return null
    const { data, error: queryError } = await (supabase as any).from('invoices').select('*, payment:payments!invoices_payment_id_fkey(status)').eq('payment_id', paymentId).eq('gym_id', gym.gym_id).maybeSingle()
    if (queryError) throw queryError
    return data ? normalizeInvoice(data) : null
  }, [gym])

  const exportInvoices = useCallback(async (rows: Invoice[] = invoices) => {
    await exportData(rows.map(invoice => ({
      'Invoice Number': invoice.invoice_number, Date: invoice.invoice_date, Member: invoice.member_name,
      Plan: invoiceItems(invoice.items)[0]?.description ?? 'Membership', Subtotal: Number(invoice.subtotal),
      Discount: Number(invoice.discount_amount), GST: Number(invoice.cgst_amount) + Number(invoice.sgst_amount), Total: Number(invoice.total_amount),
      'Payment Status': invoice.payment?.status ?? 'captured', 'Payment Reference': invoice.payment_ref,
    })), `fitstack_invoices_${new Date().toISOString().slice(0, 10)}`, 'csv')
  }, [invoices])

  return { invoices, loading, error, refresh, getInvoice, getInvoiceByPayment, exportInvoices }
}
