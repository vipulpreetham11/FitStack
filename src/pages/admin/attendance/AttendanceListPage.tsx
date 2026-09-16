import { useState } from 'react'
import { Link } from 'react-router-dom'
import { QrCode, Users, Clock, BarChart2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { QuickCheckInPanel } from '@/components/attendance/QuickCheckInPanel'
import { useAttendance } from '@/hooks/useAttendance'
import { useGym } from '@/hooks/useGym'
import { formatDateTime } from '@/lib/format'

const METHOD_LABELS: Record<string, string> = { qr: 'QR', manual: 'Manual', biometric: 'Biometric' }
const METHOD_COLORS: Record<string, string> = { qr: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300', manual: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300', biometric: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300' }

export default function AttendanceListPage() {
  const { role } = useGym()
  const { todayAttendance, loading, error, refresh, stats } = useAttendance()
  const [search, setSearch] = useState('')
  const [methodFilter, setMethodFilter] = useState<string>('all')
  const canQuickCheckIn = role !== null && ['owner', 'admin', 'receptionist'].includes(role)
  const currentlyCheckedIn = todayAttendance

  const filtered = todayAttendance.filter(a => {
    const name = a.member?.profiles?.full_name?.toLowerCase() ?? ''
    const code = a.member?.member_code?.toLowerCase() ?? ''
    const matchSearch = !search || name.includes(search.toLowerCase()) || code.includes(search.toLowerCase())
    const matchMethod = methodFilter === 'all' || a.method === methodFilter
    return matchSearch && matchMethod
  })

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Attendance</h1>
          <p className="mt-1 text-muted-foreground">Today's check-ins — live updating</p>
        </div>
        <Button nativeButton={false} render={<Link to="/admin/attendance/scanner">Open Scanner <QrCode className="ml-2 h-4 w-4 inline" /></Link>} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Currently in gym', value: stats.currentlyIn, icon: Users, color: 'text-emerald-600' },
          { label: 'Total check-ins today', value: stats.totalToday, icon: BarChart2, color: 'text-sky-600' },
          { label: 'Unique members today', value: stats.uniqueToday, icon: Clock, color: 'text-purple-600' },
        ].map(card => (
          <Card key={card.label}>
            <CardContent className="pt-5">
              {loading ? <Skeleton className="h-8 w-12 mb-1" /> : <p className={`text-3xl font-bold ${card.color}`}>{card.value}</p>}
              <p className="text-sm text-muted-foreground mt-1">{card.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {canQuickCheckIn && (
        <div className="grid gap-4 lg:grid-cols-2">
          <QuickCheckInPanel onCheckedIn={refresh} />
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Currently Checked In</CardTitle>
              <CardDescription>Live check-ins recorded today.</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">{[0, 1, 2].map(item => <Skeleton key={item} className="h-14" />)}</div>
              ) : currentlyCheckedIn.length === 0 ? (
                <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">No members are currently checked in.</div>
              ) : (
                <div className="divide-y">
                  {currentlyCheckedIn.slice(0, 8).map(item => (
                    <div key={item.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{item.member?.profiles?.full_name ?? 'Unknown member'}</p>
                        <p className="text-sm text-muted-foreground">{formatDateTime(item.check_in_at).split(', ')[1]}</p>
                      </div>
                      <Badge className={METHOD_COLORS[item.method ?? 'manual'] ?? ''}>{METHOD_LABELS[item.method ?? 'manual'] ?? item.method}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search member…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <div className="flex gap-2">
          {['all', 'qr', 'manual', 'biometric'].map(m => (
            <button
              key={m}
              onClick={() => setMethodFilter(m)}
              className={`rounded-full px-3 py-1 text-sm border transition-colors ${methodFilter === m ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted'}`}
            >{m === 'all' ? 'All' : METHOD_LABELS[m] ?? m}</button>
          ))}
        </div>
        <Button nativeButton={false} variant="outline" render={<Link to="/admin/attendance/history">View history</Link>} />
      </div>

      {error && <div role="alert" className="rounded-lg border border-destructive/30 p-3 text-destructive text-sm">{error}</div>}

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
      ) : (
        <div className="rounded-xl border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Member</TableHead>
                <TableHead className="hidden sm:table-cell">Code</TableHead>
                <TableHead>Method</TableHead>
                <TableHead className="hidden md:table-cell">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="h-32 text-center text-muted-foreground">No check-ins yet today.</TableCell></TableRow>
              ) : filtered.map(a => {
                return (
                  <TableRow key={a.id}>
                    <TableCell className="font-mono text-sm">{formatDateTime(a.check_in_at).split(', ')[1]}</TableCell>
                    <TableCell className="font-medium">{a.member?.profiles?.full_name ?? '—'}</TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">{a.member?.member_code ?? '—'}</TableCell>
                    <TableCell>
                      <Badge className={METHOD_COLORS[a.method ?? 'manual'] ?? ''}>{METHOD_LABELS[a.method ?? 'manual'] ?? a.method}</Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">OK</Badge>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
