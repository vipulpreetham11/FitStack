import { useState } from 'react'
import { Clock, Footprints, Gauge, Trophy, Users } from 'lucide-react'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import ReportsNav from '@/components/reports/ReportsNav'
import { ReportControls } from '@/components/reports/ReportControls'
import ReportMetric from '@/components/reports/ReportMetric'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useGym } from '@/hooks/useGym'
import { useAttendanceReport, type DateRange, type ReportPeriod } from '@/hooks/useReports'
import { exportData } from '@/lib/export'
import { formatDate, formatDateTime } from '@/lib/format'
import { toDateOnly } from '@/lib/membership'

export default function AttendanceReportPage() {
  const { gym } = useGym(); const [period, setPeriod] = useState<ReportPeriod>('month'); const [custom, setCustom] = useState<DateRange>({ from: `${toDateOnly().slice(0, 7)}-01`, to: toDateOnly() }); const report = useAttendanceReport(period, custom)
  const name = gym?.name ?? 'FitStack'; const exportSummary = () => void exportData(report.rows.map(r => ({ Date: r.date, Day: r.day, 'Total Check-ins': r.checkIns, 'Unique Members': r.uniqueMembers, 'Peak Hour': r.peakHour })), `Attendance_${name}_${report.range.from}_${report.range.to}`, 'xlsx'); const exportRaw = () => void exportData(report.raw.map(r => ({ Date: r.date, Member: r.member, Method: r.method, 'Check In': formatDateTime(r.checkIn), 'Check Out': r.checkOut ? formatDateTime(r.checkOut) : '' })), `Attendance_Raw_${name}_${report.range.from}_${report.range.to}`, 'xlsx')
  return <div className="space-y-6 pb-10"><div><h1 className="text-3xl font-semibold tracking-tight">Reports</h1><p className="mt-1 text-muted-foreground">Footfall patterns and member activity.</p></div><ReportsNav /><ReportControls period={period} from={custom.from} to={custom.to} onPeriod={setPeriod} onFrom={from => setCustom(v => ({ ...v, from }))} onTo={to => setCustom(v => ({ ...v, to }))} onExport={exportSummary} exportLabel="Export summary" />
    <div className="flex justify-end"><Button variant="outline" onClick={exportRaw}>Export raw attendance</Button></div>{report.error && <div role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">{report.error}</div>}
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-5"><ReportMetric label="Total check-ins" value={report.summary.total} icon={Footprints} loading={report.loading} /><ReportMetric label="Unique members" value={report.summary.unique} icon={Users} loading={report.loading} /><ReportMetric label="Avg daily footfall" value={report.summary.average.toFixed(1)} icon={Gauge} loading={report.loading} /><ReportMetric label="Peak hour" value={report.summary.peakHour} icon={Clock} loading={report.loading} /><ReportMetric label="Most active member" value={report.summary.mostActive} icon={Trophy} loading={report.loading} /></div>
    <div className="grid gap-6 lg:grid-cols-2"><Card><CardHeader><CardTitle className="text-base">Daily footfall</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={260}><BarChart data={[...report.rows].reverse()}><XAxis dataKey="date" tickFormatter={v => String(v).slice(5)} tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="checkIns" name="Check-ins" fill={gym?.brand_color ?? '#171717'} radius={[3,3,0,0]} /></BarChart></ResponsiveContainer></CardContent></Card><Card><CardHeader><CardTitle className="text-base">Hourly distribution · 6 AM–10 PM</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={260}><BarChart data={report.hourly}><XAxis dataKey="hour" tickFormatter={v => `${v}:00`} tick={{ fontSize: 10 }} /><YAxis allowDecimals={false} /><Tooltip labelFormatter={v => `${v}:00`} /><Bar dataKey="count" name="Check-ins" fill="#0284c7" radius={[3,3,0,0]} /></BarChart></ResponsiveContainer></CardContent></Card></div>
    <Card><CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Day</TableHead><TableHead>Total check-ins</TableHead><TableHead>Unique members</TableHead><TableHead>Peak hour</TableHead></TableRow></TableHeader><TableBody>{report.rows.map(r => <TableRow key={r.date}><TableCell>{formatDate(r.date)}</TableCell><TableCell>{r.day}</TableCell><TableCell>{r.checkIns}</TableCell><TableCell>{r.uniqueMembers}</TableCell><TableCell>{r.peakHour}</TableCell></TableRow>)}{!report.loading && !report.rows.length && <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">No attendance data in this period.</TableCell></TableRow>}</TableBody></Table></div></CardContent></Card>
  </div>
}
