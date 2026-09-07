import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Copy, CreditCard, IndianRupee, TriangleAlert, WalletCards } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { usePayments, type Payment } from '@/hooks/usePayments'
import { formatCurrency, formatDate } from '@/lib/format'
import { toDateOnly } from '@/lib/membership'

function badge(status: string) {
  if (status === 'captured') return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300'
  if (status === 'failed') return 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/60 dark:text-red-300'
  return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-300'
}

function inRange(payment: Payment, range: string, from: string, to: string) {
  const date = toDateOnly(new Date(payment.created_at)); const today = toDateOnly()
  if (range === 'month') return date.slice(0, 7) === today.slice(0, 7)
  if (range === 'week') { const start = new Date(); start.setDate(start.getDate() - 6); return date >= toDateOnly(start) && date <= today }
  if (range === 'custom') return (!from || date >= from) && (!to || date <= to)
  return true
}

export default function PaymentListPage() {
  const { payments, loading, error, stats } = usePayments()
  const [status, setStatus] = useState('all')
  const [range, setRange] = useState('month')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const filtered = useMemo(() => payments.filter(item => (status === 'all' || item.status === status) && inRange(item, range, from, to)), [from, payments, range, status, to])

  async function copyId(value: string) {
    try { await navigator.clipboard.writeText(value); setCopied(value); toast.success('Razorpay ID copied'); window.setTimeout(() => setCopied(null), 1500) }
    catch { toast.error('Could not copy the payment ID') }
  }

  const cards = [
    { label: 'Collected this month', value: formatCurrency(stats.totalThisMonth), icon: IndianRupee },
    { label: 'Payments today', value: String(stats.countToday), icon: CreditCard },
    { label: 'Pending', value: String(stats.pending), icon: WalletCards },
    { label: 'Failed this month', value: String(stats.failedThisMonth), icon: TriangleAlert },
  ]

  return <div className="space-y-6 pb-12">
    <div><h1 className="text-3xl font-semibold tracking-tight">Payments</h1><p className="mt-2 text-muted-foreground">Track collections, pending checkouts, failures, and invoices.</p></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(item => <Card key={item.label}><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{item.label}</CardTitle><item.icon className="size-4 text-muted-foreground" aria-hidden="true" /></CardHeader><CardContent><p className="text-2xl font-semibold tabular-nums">{item.value}</p></CardContent></Card>)}</div>
    <Card><div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-end"><div className="space-y-2"><label className="text-sm font-medium">Status</label><Select value={status} onValueChange={value => setStatus(value ?? 'all')}><SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="captured">Captured</SelectItem><SelectItem value="created">Created (pending)</SelectItem><SelectItem value="failed">Failed</SelectItem></SelectContent></Select></div><div className="space-y-2"><label className="text-sm font-medium">Date range</label><Select value={range} onValueChange={value => setRange(value ?? 'month')}><SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="week">This week</SelectItem><SelectItem value="month">This month</SelectItem><SelectItem value="all">All time</SelectItem><SelectItem value="custom">Custom range</SelectItem></SelectContent></Select></div>{range === 'custom' && <><div className="space-y-2"><label htmlFor="payment-from" className="text-sm font-medium">From</label><Input id="payment-from" type="date" value={from} onChange={event => setFrom(event.target.value)} /></div><div className="space-y-2"><label htmlFor="payment-to" className="text-sm font-medium">To</label><Input id="payment-to" type="date" min={from} value={to} onChange={event => setTo(event.target.value)} /></div></>}</div>
      <CardContent className="p-0">{error ? <div role="alert" className="p-6 text-sm text-destructive">{error}</div> : loading ? <div className="space-y-3 p-4">{[0, 1, 2].map(item => <Skeleton key={item} className="h-12" />)}</div> : <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Member</TableHead><TableHead>Description</TableHead><TableHead>Amount</TableHead><TableHead>GST</TableHead><TableHead>Total</TableHead><TableHead>Status</TableHead><TableHead>Razorpay ID</TableHead><TableHead>Invoice</TableHead></TableRow></TableHeader><TableBody>{filtered.length === 0 ? <TableRow><TableCell colSpan={9} className="py-12 text-center text-muted-foreground">No payments match these filters.</TableCell></TableRow> : filtered.map(payment => <TableRow key={payment.id}><TableCell className="whitespace-nowrap">{formatDate(payment.created_at)}</TableCell><TableCell className="font-medium">{payment.member?.profiles?.full_name ?? 'Unknown member'}</TableCell><TableCell>{payment.description ?? 'Membership payment'}</TableCell><TableCell>{formatCurrency(Number(payment.amount))}</TableCell><TableCell>{formatCurrency(Number(payment.cgst_amount) + Number(payment.sgst_amount))}</TableCell><TableCell className="font-semibold tabular-nums">{formatCurrency(Number(payment.total_amount))}</TableCell><TableCell><Badge variant="outline" className={badge(payment.status)}>{payment.status}</Badge></TableCell><TableCell>{payment.razorpay_payment_id ? <Button variant="ghost" size="sm" className="font-mono text-xs" aria-label={`Copy Razorpay payment ID ${payment.razorpay_payment_id}`} onClick={() => void copyId(payment.razorpay_payment_id as string)}>{copied === payment.razorpay_payment_id ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}{payment.razorpay_payment_id}</Button> : <span className="text-muted-foreground">—</span>}</TableCell><TableCell>{payment.invoice?.id ? <Button nativeButton={false} variant="outline" size="sm" render={<Link to={`/admin/invoices/${payment.invoice.id}`}>View Invoice</Link>} /> : <span className="text-muted-foreground">—</span>}</TableCell></TableRow>)}</TableBody></Table></div>}</CardContent>
    </Card>
  </div>
}
