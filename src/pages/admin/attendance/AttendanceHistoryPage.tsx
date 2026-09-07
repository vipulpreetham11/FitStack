import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAttendance, type Attendance } from '@/hooks/useAttendance'
import { formatDateTime, formatDate } from '@/lib/format'
import { toDateOnly, addDays } from '@/lib/membership'

const METHOD_LABELS: Record<string, string> = { qr: 'QR', manual: 'Manual', biometric: 'Biometric' }
const METHOD_COLORS: Record<string, string> = { qr: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300', manual: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300', biometric: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300' }

function exportCsv(rows: Attendance[]) {
  const header = 'Date,Time,Member,Code,Method'
  const lines = rows.map(a => {
    const dt = new Date(a.check_in_at)
    const d = formatDate(dt)
    const t = formatDateTime(dt).split(', ')[1] ?? ''
    const name = a.member?.profiles?.full_name ?? ''
    const code = a.member?.member_code ?? ''
    return [d, t, name, code, a.method ?? ''].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
  })
  const blob = new Blob([header + '\n' + lines.join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = `attendance_${toDateOnly()}.csv`; a.click()
  URL.revokeObjectURL(url)
}

export default function AttendanceHistoryPage() {
  const { getAttendanceHistory } = useAttendance()
  const today = toDateOnly()
  const [startDate, setStartDate] = useState(addDays(today, -29))
  const [endDate, setEndDate] = useState(today)
  const [rows, setRows] = useState<Attendance[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const data = await getAttendanceHistory(startDate, endDate)
      setRows(data)
    } catch (err: any) {
      setError(err.message ?? 'Failed to load history')
    } finally { setLoading(false) }
  }, [getAttendanceHistory, startDate, endDate])

  useEffect(() => { void load() }, [load])

  const uniqueMembers = new Set(rows.map(r => r.member_id)).size
  const dates = new Set(rows.map(r => r.check_in_at.slice(0, 10)))
  const avgDaily = dates.size > 0 ? (rows.length / dates.size).toFixed(1) : '0'

  return (
    <div className="space-y-6 pb-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Attendance History</h1>
        <p className="mt-1 text-muted-foreground">View and export past attendance records</p>
      </div>

      {/* Date filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="text-sm text-muted-foreground block mb-1">From</label>
          <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-40" />
        </div>
        <div>
          <label className="text-sm text-muted-foreground block mb-1">To</label>
          <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-40" />
        </div>
        <Button variant="outline" onClick={() => void load()}>Apply</Button>
        <Button variant="outline" onClick={() => exportCsv(rows)} disabled={rows.length === 0}>Export CSV</Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total check-ins', value: rows.length },
          { label: 'Unique members', value: uniqueMembers },
          { label: 'Avg daily footfall', value: avgDaily },
        ].map(card => (
          <Card key={card.label}>
            <CardContent className="pt-5">
              {loading ? <Skeleton className="h-8 w-12 mb-1" /> : <p className="text-3xl font-bold">{card.value}</p>}
              <p className="text-sm text-muted-foreground mt-1">{card.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {error && <div role="alert" className="rounded-lg border border-destructive/30 p-3 text-destructive text-sm">{error}</div>}

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
      ) : (
        <div className="rounded-xl border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Member</TableHead>
                <TableHead className="hidden sm:table-cell">Code</TableHead>
                <TableHead>Method</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="h-32 text-center text-muted-foreground">No records in this date range.</TableCell></TableRow>
              ) : rows.map(a => (
                <TableRow key={a.id}>
                  <TableCell className="text-sm">{formatDate(a.check_in_at)}</TableCell>
                  <TableCell className="font-mono text-sm">{formatDateTime(a.check_in_at).split(', ')[1]}</TableCell>
                  <TableCell className="font-medium">{a.member?.profiles?.full_name ?? '—'}</TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">{a.member?.member_code ?? '—'}</TableCell>
                  <TableCell>
                    <Badge className={METHOD_COLORS[a.method ?? 'manual'] ?? ''}>{METHOD_LABELS[a.method ?? 'manual'] ?? a.method}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
