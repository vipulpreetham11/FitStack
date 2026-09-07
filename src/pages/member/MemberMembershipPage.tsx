import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { MembershipStatusBadge } from '@/components/memberships/MembershipStatusBadge'
import { useGym } from '@/hooks/useGym'
import { useMemberships } from '@/hooks/useMemberships'
import { daysRemaining, membershipProgress } from '@/lib/membership'
import { formatDate } from '@/lib/format'

export default function MemberMembershipPage() {
  const { gymMember } = useGym()
  const { memberships, loading, error } = useMemberships()
  const mine = memberships.filter(item => !gymMember || item.member_id === gymMember.id)
  const current = mine.find(item => ['active', 'frozen', 'scheduled'].includes(item.status)) ?? null
  const history = mine.filter(item => item.id !== current?.id)
  const progress = current ? membershipProgress(current.start_date, current.end_date) : 0

  if (loading) return <div className="space-y-4"><Skeleton className="h-10 w-56" /><Skeleton className="h-72" /></div>

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Your membership</h1>
        <p className="mt-2 text-muted-foreground">Your current access and membership history.</p>
      </div>
      {error && <div role="alert" className="rounded-lg border border-destructive/30 p-4 text-destructive">{error}</div>}
      {current ? (
        <Card className="overflow-hidden border-l-4 border-l-primary">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <CardTitle>{current.plan?.name ?? 'Membership'}</CardTitle>
              <MembershipStatusBadge status={current.status} />
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div><dt className="text-sm text-muted-foreground">Start date</dt><dd className="mt-1 font-medium">{formatDate(current.start_date)}</dd></div>
              <div><dt className="text-sm text-muted-foreground">End date</dt><dd className="mt-1 font-medium">{formatDate(current.end_date)}</dd></div>
              <div><dt className="text-sm text-muted-foreground">Days remaining</dt><dd className="mt-1 font-medium">{current.status === 'frozen' ? 'Paused' : daysRemaining(current.end_date)}</dd></div>
            </dl>
            <div>
              <div className="mb-2 flex justify-between text-sm"><span>Membership used</span><span>{progress}%</span></div>
              <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Membership used" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
                <div className={`h-full rounded-full ${current.status === 'frozen' ? 'bg-indigo-500' : 'bg-emerald-500'}`} style={{ width: `${progress}%` }} />
              </div>
            </div>
            {current.status === 'frozen' && <p className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-800 dark:border-indigo-900 dark:bg-indigo-950/50 dark:text-indigo-200">Your membership is frozen until {current.frozen_until ? formatDate(current.frozen_until) : 'it is resumed'}.</p>}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center py-14 text-center">
            <h2 className="text-lg font-medium">No active membership</h2>
            <p className="mt-2 text-muted-foreground">Browse the available plans to get started.</p>
            <Button nativeButton={false} className="mt-5 min-h-11" render={<Link to="/member/plans">Browse Plans</Link>} />
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader><CardTitle className="text-lg">Membership history</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Plan</TableHead><TableHead>Dates</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>{history.length === 0 ? <TableRow><TableCell colSpan={3} className="h-28 text-center text-muted-foreground">No past memberships.</TableCell></TableRow> : history.map(item => (
                <TableRow key={item.id}><TableCell className="font-medium">{item.plan?.name ?? 'Unknown plan'}</TableCell><TableCell>{formatDate(item.start_date)} – {formatDate(item.end_date)}</TableCell><TableCell><MembershipStatusBadge status={item.status} /></TableCell></TableRow>
              ))}</TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
