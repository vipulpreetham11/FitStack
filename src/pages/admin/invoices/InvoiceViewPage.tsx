import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { ChevronLeft, Download, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { invoiceItems, useInvoices, type Invoice } from '@/hooks/useInvoices'
import { useGym } from '@/hooks/useGym'
import { formatCurrency, formatDate } from '@/lib/format'

export default function InvoiceViewPage() {
  const { invoiceId } = useParams<{ invoiceId: string }>()
  const location = useLocation()
  const { gym } = useGym()
  const { getInvoice } = useInvoices()
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [error, setError] = useState<string | null>(null)
  const memberView = location.pathname.startsWith('/member/')

  useEffect(() => {
    if (!invoiceId) return
    let alive = true
    getInvoice(invoiceId).then(value => { if (alive) setInvoice(value) }).catch(cause => { if (alive) setError(cause instanceof Error ? cause.message : 'Could not load invoice') })
    return () => { alive = false }
  }, [getInvoice, invoiceId])

  if (error) return <div role="alert" className="rounded-lg border border-destructive/30 p-6 text-destructive">{error}</div>
  if (!invoice) return <div className="space-y-4"><Skeleton className="h-10 w-52" /><Skeleton className="mx-auto h-[760px] max-w-4xl" /></div>
  const items = invoiceItems(invoice.items)
  const hasGst = Boolean(invoice.gym_gstin)
  const address = invoice.gym_address?.trim()

  return <div className="space-y-5 pb-12">
    <div className="invoice-screen-actions flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><Button nativeButton={false} variant="ghost" render={<Link to={memberView ? '/member/payments' : '/admin/invoices'}><ChevronLeft aria-hidden="true" /> Back to invoices</Link>} /><div className="flex gap-2"><Button variant="outline" onClick={() => window.print()}><Printer aria-hidden="true" /> Print</Button><Button onClick={() => window.print()}><Download aria-hidden="true" /> Save as PDF</Button></div></div>
    <article className="invoice-print-root mx-auto min-h-[270mm] max-w-[210mm] bg-white p-6 text-slate-950 shadow-sm ring-1 ring-slate-200 sm:p-10 lg:p-14">
      <header className="flex flex-col justify-between gap-8 border-b border-slate-300 pb-8 sm:flex-row">
        <div className="flex items-start gap-4">{gym?.logo_url && <img src={gym.logo_url} alt={`${invoice.gym_name} logo`} className="h-16 w-16 rounded-lg object-contain ring-1 ring-slate-200" />}<div><h1 className="text-xl font-bold tracking-tight">{invoice.gym_name}</h1>{address && <p className="mt-2 max-w-sm whitespace-pre-line text-sm leading-6 text-slate-600">{address}</p>}{hasGst && <p className="mt-1 text-sm text-slate-600">GSTIN: {invoice.gym_gstin}</p>}</div></div>
        <div className="sm:text-right"><p className="text-3xl font-light tracking-[0.16em] text-slate-700">INVOICE</p><dl className="mt-4 space-y-1 text-sm"><div className="flex gap-3 sm:justify-end"><dt className="text-slate-500">Invoice #</dt><dd className="font-mono font-semibold">{invoice.invoice_number}</dd></div><div className="flex gap-3 sm:justify-end"><dt className="text-slate-500">Date</dt><dd>{formatDate(invoice.invoice_date)}</dd></div></dl></div>
      </header>
      <section className="py-8"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Bill to</p><h2 className="mt-2 text-lg font-semibold">{invoice.member_name}</h2>{invoice.member_phone && <p className="mt-1 text-sm text-slate-600">Phone: {invoice.member_phone}</p>}</section>
      <div className="overflow-hidden rounded-lg border border-slate-300"><table className="w-full text-left text-sm"><thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600"><tr><th className="px-4 py-3">Description</th><th className="px-3 py-3">SAC</th><th className="px-3 py-3 text-right">Qty</th><th className="px-3 py-3 text-right">Rate</th><th className="px-4 py-3 text-right">Amount</th></tr></thead><tbody>{items.map((item, index) => <tr key={`${item.description}-${index}`} className="border-t border-slate-200"><td className="px-4 py-4 font-medium">{item.description}</td><td className="px-3 py-4 font-mono text-slate-600">{item.sac_code ?? '—'}</td><td className="px-3 py-4 text-right tabular-nums">{item.qty}</td><td className="px-3 py-4 text-right tabular-nums">{formatCurrency(item.rate)}</td><td className="px-4 py-4 text-right font-medium tabular-nums">{formatCurrency(item.amount)}</td></tr>)}</tbody></table></div>
      <section className="ml-auto mt-8 max-w-sm"><dl className="space-y-2 text-sm tabular-nums"><div className="flex justify-between gap-8"><dt className="text-slate-600">Subtotal</dt><dd>{formatCurrency(Number(invoice.subtotal))}</dd></div>{Number(invoice.discount_amount) > 0 && <div className="flex justify-between gap-8 text-emerald-700"><dt>Discount</dt><dd>−{formatCurrency(Number(invoice.discount_amount))}</dd></div>}<div className="flex justify-between gap-8 border-t border-slate-200 pt-2"><dt className="text-slate-600">Taxable amount</dt><dd>{formatCurrency(Number(invoice.taxable_amount))}</dd></div>{hasGst && <><div className="flex justify-between gap-8"><dt className="text-slate-600">CGST {Number(invoice.cgst_rate)}%</dt><dd>{formatCurrency(Number(invoice.cgst_amount))}</dd></div><div className="flex justify-between gap-8"><dt className="text-slate-600">SGST {Number(invoice.sgst_rate)}%</dt><dd>{formatCurrency(Number(invoice.sgst_amount))}</dd></div></>}<div className="mt-3 flex justify-between gap-8 border-t-2 border-slate-900 pt-3 text-lg font-bold"><dt>Total</dt><dd>{formatCurrency(Number(invoice.total_amount))}</dd></div></dl></section>
      <footer className="mt-12 border-t border-slate-300 pt-6 text-sm"><div className="grid gap-2 sm:grid-cols-2"><p><span className="text-slate-500">Payment method:</span> {invoice.payment_method === 'free' ? 'Free checkout' : 'Online (Razorpay)'}</p>{invoice.payment_ref && <p className="break-all sm:text-right"><span className="text-slate-500">Payment reference:</span> {invoice.payment_ref}</p>}</div>{invoice.notes && <p className="mt-4 text-slate-600">{invoice.notes}</p>}<p className="mt-10 text-center text-xs text-slate-500">Computer-generated invoice. No signature required.</p></footer>
    </article>
  </div>
}
