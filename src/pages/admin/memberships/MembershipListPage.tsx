import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarClock, Dumbbell, Snowflake, Users, UserX } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { MembershipStatusBadge } from '@/components/memberships/MembershipStatusBadge'
import { membershipDaysRemaining, useMemberships } from '@/hooks/useMemberships'
import { formatDate } from '@/lib/format'

const summaries = [
  ['active', 'Total active', Users],
  ['expiringSoon', 'Expiring in 7 days', CalendarClock],
  ['expired', 'Expired this month', UserX],
  ['frozen', 'Frozen', Snowflake],
] as const

export default function MembershipListPage() {
  const { memberships, loading, error, stats } = useMemberships()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const filtered = useMemo(() => memberships.filter(item => {
    const name = item.member?.profiles?.full_name ?? ''
    return (status === 'all' || item.status === status) && name.toLowerCase().includes(search.trim().toLowerCase())
  }), [memberships, search, status])

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Memberships</h1>
          <p className="mt-2 text-muted-foreground">Track active plans, renewals, freezes, and expirations.</p>
        </div>
        <Button nativeButton={false} variant="outline" className="min-h-11" render={<Link to="/admin/plans"><Dumbbell aria-hidden="true" /> Manage plans</Link>} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaries.map(([key, label, Icon]) => (
          <Card key={key} className={key === 'expiringSoon' && stats[key] > 0 ? 'border-orange-300 bg-orange-50/60 dark:border-orange-900 dark:bg-orange-950/20' : ''}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
              <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
            </CardHeader>
            <CardContent><p className="text-3xl font-semibold tabular-nums">{stats[key]}</p></CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row">
          <Input aria-label="Search memberships by member name" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search by member name" className="min-h-11 flex-1" />
          <Select value={status} onValueChange={value => setStatus(value ?? 'all')}>
            <SelectTrigger aria-label="Filter memberships by status" className="min-h-11 w-full sm:w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              {['all', 'active', 'scheduled', 'frozen', 'expired', 'cancelled'].map(value => <SelectItem key={value} value={value}>{value === 'all' ? 'All statuses' : value[0].toUpperCase() + value.slice(1)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <CardContent className="p-0">
          {error && <div role="alert" className="p-6 text-destructive">{error}</div>}
          {loading ? <div className="space-y-2 p-4">{[0, 1, 2, 3].map(item => <Skeleton key={item} className="h-12" />)}</div> : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Member</TableHead><TableHead>Plan</TableHead><TableHead>Status</TableHead><TableHead>Start date</TableHead><TableHead>End date</TableHead><TableHead>Days remaining</TableHead><TableHead /></TableRow></TableHeader>
                <TableBody>
                  {filtered.length === 0 ? <TableRow><TableCell colSpan={7} className="h-32 text-center text-muted-foreground">No memberships match these filters.</TableCell></TableRow> : filtered.map(item => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.member?.profiles?.full_name ?? 'Unknown member'}</TableCell>
                      <TableCell>{item.plan?.name ?? 'Unknown plan'}</TableCell>
                      <TableCell><MembershipStatusBadge status={item.status} /></TableCell>
                      <TableCell>{formatDate(item.start_date)}</TableCell>
                      <TableCell>{formatDate(item.end_date)}</TableCell>
                      <TableCell>{membershipDaysRemaining(item)}</TableCell>
                      <TableCell><Button nativeButton={false} variant="ghost" render={<Link to={`/admin/members/${item.member_id}`}>View member</Link>} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
