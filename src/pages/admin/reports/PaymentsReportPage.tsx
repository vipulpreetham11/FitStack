import { useState } from 'react'
import { BadgeCheck, BadgeIndianRupee, Clock3, Percent, XCircle } from 'lucide-react'
import ReportsNav from '@/components/reports/ReportsNav'
import { ReportControls } from '@/components/reports/ReportControls'
import ReportMetric from '@/components/reports/ReportMetric'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useGym } from '@/hooks/useGym'
import { usePaymentsReport, type DateRange, type ReportPeriod } from '@/hooks/useReports'
import { exportData } from '@/lib/export'
import { formatCurrency, formatDate } from '@/lib/format'
import { toDateOnly } from '@/lib/membership'

export default function PaymentsReportPage() {
  const { gym } = useGym(); const [period, setPeriod] = useState<ReportPeriod>('month'); const [custom, setCustom] = useState<DateRange>({ from: `${toDateOnly().slice(0, 7)}-01`, to: toDateOnly() }); const [status, setStatus] = useState('all'); const report = usePaymentsReport(period, custom); const rows = report.rows.filter(r => status === 'all' || r.status === status)
  const exportRows = () => void exportData(rows.map(r => ({ Date: r.date, Member: r.member, Description: r.description, Subtotal: r.subtotal, Discount: r.discount, GST: r.gst, Total: r.total, Status: r.status, 'Razorpay ID': r.razorpayId })), `Payments_${gym?.name ?? 'FitStack'}_${report.range.from}_${report.range.to}`, 'xlsx')
  return <div className="space-y-6 pb-10"><div><h1 className="text-3xl font-semibold tracking-tight">Reports</h1><p className="mt-1 text-muted-foreground">Payment ledger ready for GST filing and reconciliation.</p></div><ReportsNav /><ReportControls period={period} from={custom.from} to={custom.to} onPeriod={setPeriod} onFrom={from => setCustom(v => ({ ...v, from }))} onTo={to => setCustom(v => ({ ...v, to }))} onExport={exportRows} />
    {report.error && <div role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">{report.error}</div>}<div className="grid grid-cols-2 gap-4 lg:grid-cols-5"><ReportMetric label="Total collected" value={formatCurrency(report.summary.collected)} icon={BadgeIndianRupee} loading={report.loading} /><ReportMetric label="Successful" value={report.summary.successful} icon={BadgeCheck} loading={report.loading} /><ReportMetric label="Failed" value={report.summary.failed} icon={XCircle} loading={report.loading} /><ReportMetric label="Pending" value={report.summary.pending} icon={Clock3} loading={report.loading} /><ReportMetric label="Promo discounts" value={formatCurrency(report.summary.discounts)} icon={Percent} loading={report.loading} /></div>
    <Select value={status} onValueChange={value => value && setStatus(value)}><SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="captured">Captured</SelectItem><SelectItem value="created">Pending</SelectItem><SelectItem value="failed">Failed</SelectItem></SelectContent></Select>
    <Card><CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Member</TableHead><TableHead>Description</TableHead><TableHead>Subtotal</TableHead><TableHead>Discount</TableHead><TableHead>GST</TableHead><TableHead>Total</TableHead><TableHead>Status</TableHead><TableHead>Razorpay ID</TableHead></TableRow></TableHeader><TableBody>{rows.map(r => <TableRow key={r.id}><TableCell>{formatDate(r.date)}</TableCell><TableCell className="font-medium">{r.member}</TableCell><TableCell>{r.description}</TableCell><TableCell>{formatCurrency(r.subtotal)}</TableCell><TableCell>{formatCurrency(r.discount)}</TableCell><TableCell>{formatCurrency(r.gst)}</TableCell><TableCell className="font-semibold">{formatCurrency(r.total)}</TableCell><TableCell><Badge variant="secondary" className="capitalize">{r.status}</Badge></TableCell><TableCell className="max-w-40 truncate font-mono text-xs">{r.razorpayId || '—'}</TableCell></TableRow>)}{!report.loading && !rows.length && <TableRow><TableCell colSpan={9} className="h-24 text-center text-muted-foreground">No payments match these filters.</TableCell></TableRow>}</TableBody></Table></div></CardContent></Card>
  </div>
}
