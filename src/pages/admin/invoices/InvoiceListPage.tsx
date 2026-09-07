import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, FileText, Search } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { invoiceItems, useInvoices } from '@/hooks/useInvoices'
import { formatCurrency, formatDate } from '@/lib/format'
import { toDateOnly } from '@/lib/membership'

function monthOffset(offset: number) { const date = new Date(); date.setDate(1); date.setMonth(date.getMonth() + offset); return toDateOnly(date).slice(0, 7) }

export default function InvoiceListPage() {
  const { invoices, loading, error, exportInvoices } = useInvoices()
  const [search, setSearch] = useState('')
  const [range, setRange] = useState('month')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const filtered = useMemo(() => invoices.filter(invoice => {
    const query = search.trim().toLowerCase(); const date = invoice.invoice_date
    const matchesSearch = !query || invoice.invoice_number.toLowerCase().includes(query) || invoice.member_name.toLowerCase().includes(query)
    const matchesDate = range === 'all' || (range === 'month' && date.slice(0, 7) === monthOffset(0)) || (range === 'last' && date.slice(0, 7) === monthOffset(-1)) || (range === 'custom' && (!from || date >= from) && (!to || date <= to))
    return matchesSearch && matchesDate
  }), [from, invoices, range, search, to])

  async function download() { try { await exportInvoices(filtered); toast.success('Invoice CSV downloaded') } catch { toast.error('Could not export invoices') } }

  return <div className="space-y-6 pb-12"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h1 className="text-3xl font-semibold tracking-tight">Invoices</h1><p className="mt-2 text-muted-foreground">Search, review, print, and export issued invoices.</p></div><Button variant="outline" onClick={() => void download()} disabled={filtered.length === 0}><Download aria-hidden="true" /> Export CSV</Button></div>
    <Card><div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-end"><div className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" aria-hidden="true" /><Input aria-label="Search invoices" className="pl-9" placeholder="Invoice number or member name" value={search} onChange={event => setSearch(event.target.value)} /></div><div className="space-y-2"><label className="text-sm font-medium">Date range</label><Select value={range} onValueChange={value => setRange(value ?? 'month')}><SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="month">This month</SelectItem><SelectItem value="last">Last month</SelectItem><SelectItem value="all">All time</SelectItem><SelectItem value="custom">Custom range</SelectItem></SelectContent></Select></div>{range === 'custom' && <><Input aria-label="Invoice start date" type="date" value={from} onChange={event => setFrom(event.target.value)} /><Input aria-label="Invoice end date" type="date" min={from} value={to} onChange={event => setTo(event.target.value)} /></>}</div>
      <CardContent className="p-0">{error ? <div role="alert" className="p-6 text-sm text-destructive">{error}</div> : loading ? <div className="space-y-3 p-4">{[0, 1, 2].map(item => <Skeleton key={item} className="h-12" />)}</div> : filtered.length === 0 ? <div className="flex flex-col items-center py-14 text-center"><FileText className="mb-4 size-12 text-muted-foreground/30" aria-hidden="true" /><p className="font-medium">No invoices match this view</p><p className="mt-1 text-sm text-muted-foreground">Invoices are generated automatically after successful payment.</p></div> : <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Invoice #</TableHead><TableHead>Date</TableHead><TableHead>Member</TableHead><TableHead>Plan</TableHead><TableHead>Subtotal</TableHead><TableHead>GST</TableHead><TableHead>Total</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{filtered.map(invoice => <TableRow key={invoice.id}><TableCell><Link className="font-mono font-semibold underline-offset-4 hover:underline" to={`/admin/invoices/${invoice.id}`}>{invoice.invoice_number}</Link></TableCell><TableCell className="whitespace-nowrap">{formatDate(invoice.invoice_date)}</TableCell><TableCell>{invoice.member_name}</TableCell><TableCell>{invoiceItems(invoice.items)[0]?.description ?? 'Membership'}</TableCell><TableCell>{formatCurrency(Number(invoice.subtotal))}</TableCell><TableCell>{formatCurrency(Number(invoice.cgst_amount) + Number(invoice.sgst_amount))}</TableCell><TableCell className="font-semibold">{formatCurrency(Number(invoice.total_amount))}</TableCell><TableCell><Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300">{invoice.payment?.status ?? 'captured'}</Badge></TableCell></TableRow>)}</TableBody></Table></div>}</CardContent>
    </Card>
  </div>
}
