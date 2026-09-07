import { useMemo, useState } from 'react'
import { IndianRupee, ReceiptText, Sigma, WalletCards } from 'lucide-react'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import ReportsNav from '@/components/reports/ReportsNav'
import { ReportControls } from '@/components/reports/ReportControls'
import ReportMetric from '@/components/reports/ReportMetric'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useGym } from '@/hooks/useGym'
import { useRevenueReport, type DateRange, type ReportPeriod } from '@/hooks/useReports'
import { exportData } from '@/lib/export'
import { formatCurrency, formatDate } from '@/lib/format'
import { toDateOnly } from '@/lib/membership'

export default function RevenueReportPage() {
  const { gym } = useGym(); const [period, setPeriod] = useState<ReportPeriod>('month'); const [custom, setCustom] = useState<DateRange>({ from: `${toDateOnly().slice(0, 7)}-01`, to: toDateOnly() })
  const report = useRevenueReport(period, custom)
  const totals = useMemo(() => report.rows.reduce((s, r) => ({ transactions: s.transactions + r.transactions, gross: s.gross + r.gross, discounts: s.discounts + r.discounts, taxable: s.taxable + r.taxable, cgst: s.cgst + r.cgst, sgst: s.sgst + r.sgst, net: s.net + r.net }), { transactions: 0, gross: 0, discounts: 0, taxable: 0, cgst: 0, sgst: 0, net: 0 }), [report.rows])
  const exportRows = () => void exportData(report.rows.map(r => ({ Date: r.date, Transactions: r.transactions, 'Gross Revenue': r.gross, Discounts: r.discounts, Taxable: r.taxable, CGST: r.cgst, SGST: r.sgst, 'Net Revenue': r.net })), `Revenue_${gym?.name ?? 'FitStack'}_${report.range.from}_${report.range.to}`, 'xlsx')
  return <div className="space-y-6 pb-10"><div><h1 className="text-3xl font-semibold tracking-tight">Reports</h1><p className="mt-1 text-muted-foreground">Revenue, membership, attendance, and payment intelligence.</p></div><ReportsNav />
    <ReportControls period={period} from={custom.from} to={custom.to} onPeriod={setPeriod} onFrom={from => setCustom(v => ({ ...v, from }))} onTo={to => setCustom(v => ({ ...v, to }))} onExport={exportRows} />
    {report.error && <div role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">{report.error}</div>}
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4"><ReportMetric label="Total revenue" value={formatCurrency(report.summary.revenue)} icon={IndianRupee} loading={report.loading} /><ReportMetric label="Transactions" value={report.summary.transactions} icon={ReceiptText} loading={report.loading} /><ReportMetric label="Average transaction" value={formatCurrency(report.summary.average)} icon={Sigma} loading={report.loading} /><ReportMetric label="GST collected" value={formatCurrency(report.summary.gst)} icon={WalletCards} loading={report.loading} /></div>
    <Card><CardHeader><CardTitle className="text-base">Revenue trend</CardTitle></CardHeader><CardContent>{report.chart.length ? <ResponsiveContainer width="100%" height={280}><LineChart data={report.chart}><XAxis dataKey="date" tickFormatter={v => String(v).slice(5)} tick={{ fontSize: 11 }} /><YAxis width={54} tickFormatter={v => `₹${Math.round(Number(v) / 1000)}k`} tick={{ fontSize: 11 }} /><Tooltip formatter={v => [formatCurrency(Number(v)), 'Revenue']} labelFormatter={v => formatDate(String(v))} /><Line dataKey="revenue" type="monotone" stroke={gym?.brand_color ?? '#171717'} strokeWidth={2.5} dot={false} /></LineChart></ResponsiveContainer> : <p className="py-20 text-center text-sm text-muted-foreground">No captured revenue in this period.</p>}</CardContent></Card>
    <Card><CardHeader><CardTitle className="text-base">Revenue by date</CardTitle></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Transactions</TableHead><TableHead>Gross</TableHead><TableHead>Discounts</TableHead><TableHead>Taxable</TableHead><TableHead>CGST</TableHead><TableHead>SGST</TableHead><TableHead>Net</TableHead></TableRow></TableHeader><TableBody>{report.rows.map(r => <TableRow key={r.date}><TableCell>{formatDate(r.date)}</TableCell><TableCell>{r.transactions}</TableCell><TableCell>{formatCurrency(r.gross)}</TableCell><TableCell>{formatCurrency(r.discounts)}</TableCell><TableCell>{formatCurrency(r.taxable)}</TableCell><TableCell>{formatCurrency(r.cgst)}</TableCell><TableCell>{formatCurrency(r.sgst)}</TableCell><TableCell className="font-semibold">{formatCurrency(r.net)}</TableCell></TableRow>)}{!report.loading && !report.rows.length && <TableRow><TableCell colSpan={8} className="h-24 text-center text-muted-foreground">No revenue data.</TableCell></TableRow>}</TableBody>{report.rows.length > 0 && <TableFooter><TableRow><TableCell>Total</TableCell><TableCell>{totals.transactions}</TableCell><TableCell>{formatCurrency(totals.gross)}</TableCell><TableCell>{formatCurrency(totals.discounts)}</TableCell><TableCell>{formatCurrency(totals.taxable)}</TableCell><TableCell>{formatCurrency(totals.cgst)}</TableCell><TableCell>{formatCurrency(totals.sgst)}</TableCell><TableCell>{formatCurrency(totals.net)}</TableCell></TableRow></TableFooter>}</Table></div></CardContent></Card>
  </div>
}
