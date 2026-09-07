import { Link } from 'react-router-dom'
import { CreditCard, FileText } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { usePayments } from '@/hooks/usePayments'
import { formatCurrency, formatDate } from '@/lib/format'

function badge(status: string) {
  if (status === 'captured') return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300'
  if (status === 'failed') return 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/60 dark:text-red-300'
  return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-300'
}

export default function MemberPaymentsPage() {
  const { payments, loading, error } = usePayments()
  return <div className="space-y-6 pb-8"><div><h1 className="text-3xl font-semibold tracking-tight">Your payments</h1><p className="mt-2 text-muted-foreground">Receipts and invoices for your membership purchases.</p></div>
    {error && <div role="alert" className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive">{error}</div>}
    {loading ? <div className="space-y-3">{[0, 1, 2].map(item => <Skeleton key={item} className="h-32" />)}</div> : payments.length === 0 ? <Card className="border-dashed"><CardContent className="flex flex-col items-center py-14 text-center"><CreditCard className="mb-4 size-12 text-muted-foreground/30" aria-hidden="true" /><h2 className="text-lg font-medium">No payments yet</h2><p className="mt-2 text-muted-foreground">Completed and pending checkouts will appear here.</p></CardContent></Card> : <div className="space-y-3">{payments.map(payment => <Card key={payment.id}><CardContent className="space-y-4 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{payment.description ?? 'Membership payment'}</p><p className="mt-1 text-sm text-muted-foreground">{formatDate(payment.created_at)}</p></div><Badge variant="outline" className={badge(payment.status)}>{payment.status}</Badge></div><div className="flex items-end justify-between gap-3 border-t pt-3"><div><p className="text-xs text-muted-foreground">Total paid</p><p className="text-lg font-semibold tabular-nums">{formatCurrency(Number(payment.total_amount))}</p></div>{payment.invoice?.id && <Button nativeButton={false} variant="outline" render={<Link to={`/member/invoices/${payment.invoice.id}`}><FileText aria-hidden="true" /> View Invoice</Link>} />}</div></CardContent></Card>)}</div>}
  </div>
}
