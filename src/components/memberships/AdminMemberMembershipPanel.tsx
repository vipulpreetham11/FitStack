import { useCallback, useEffect, useMemo, useState } from 'react'
import { FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { MembershipStatusBadge } from '@/components/memberships/MembershipStatusBadge'
import { MembershipTimeline } from '@/components/memberships/MembershipTimeline'
import {
  CancelMembershipModal,
  CreateMembershipModal,
  ExtendMembershipModal,
  FreezeMembershipModal,
  ResumeMembershipButton,
} from '@/components/memberships/MembershipActions'
import { useGym } from '@/hooks/useGym'
import { useMemberships, type Membership, type MembershipEvent } from '@/hooks/useMemberships'
import { daysRemaining } from '@/lib/membership'
import { formatDate } from '@/lib/format'

type Member = { id: string; name: string; phone: string | null }

export function AdminMemberMembershipPanel({ member }: { member: Member }) {
  const { hasPermission } = useGym()
  const { getMemberMemberships, getMembershipEvents } = useMemberships()
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [events, setEvents] = useState<MembershipEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [freezeOpen, setFreezeOpen] = useState(false)
  const [extendOpen, setExtendOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const canManage = hasPermission('memberships.manage')

  const current = useMemo(
    () => memberships.find(item => ['active', 'frozen'].includes(item.status))
      ?? memberships.find(item => item.status === 'scheduled')
      ?? null,
    [memberships],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const rows = await getMemberMemberships(member.id)
      setMemberships(rows)
      const focus = rows.find(item => ['active', 'frozen'].includes(item.status)) ?? rows.find(item => item.status === 'scheduled')
      setEvents(focus ? await getMembershipEvents(focus.id) : [])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load memberships')
    } finally {
      setLoading(false)
    }
  }, [getMemberMemberships, getMembershipEvents, member.id])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) return <div className="space-y-4"><Skeleton className="h-56" /><Skeleton className="h-64" /></div>

  if (error) return (
    <Card className="border-destructive/40">
      <CardContent className="flex flex-col items-center py-10 text-center">
        <h2 className="text-lg font-medium">Could not load memberships</h2>
        <p role="alert" className="mt-2 max-w-md text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" className="mt-5" onClick={() => void load()}>Try again</Button>
      </CardContent>
    </Card>
  )

  const previous = memberships.filter(item => item.id !== current?.id)
  const actions = current && canManage && ['active', 'frozen', 'scheduled'].includes(current.status)

  return (
    <div className="space-y-6">
      {current ? (
        <Card className="overflow-hidden border-l-4 border-l-primary">
          <CardHeader className="bg-muted/30">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><CardTitle>{current.plan?.name ?? 'Membership'}</CardTitle><p className="mt-1 text-sm text-muted-foreground">Current membership</p></div>
              <MembershipStatusBadge status={current.status} />
            </div>
          </CardHeader>
          <CardContent className="space-y-5 pt-6">
            <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div><dt className="text-sm text-muted-foreground">Start date</dt><dd className="mt-1 font-medium">{formatDate(current.start_date)}</dd></div>
              <div><dt className="text-sm text-muted-foreground">End date</dt><dd className="mt-1 font-medium">{formatDate(current.end_date)}</dd></div>
              <div><dt className="text-sm text-muted-foreground">Days remaining</dt><dd className="mt-1 font-medium">{current.status === 'frozen' ? 'Paused' : `${daysRemaining(current.end_date)} days`}</dd></div>
              <div><dt className="text-sm text-muted-foreground">Freezes used</dt><dd className="mt-1 font-medium">{current.freeze_count}</dd></div>
            </dl>
            {actions && (
              <div className="flex flex-wrap gap-2 border-t pt-4">
                {current.status === 'active' && <Button variant="outline" onClick={() => setFreezeOpen(true)}>Freeze</Button>}
                {current.status === 'frozen' && <ResumeMembershipButton membership={current} onSuccess={load} />}
                {['active', 'frozen'].includes(current.status) && <Button variant="outline" onClick={() => setExtendOpen(true)}>Extend</Button>}
                <Button variant="destructive" onClick={() => setCancelOpen(true)}>Cancel</Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center py-12 text-center">
            <FileText className="mb-4 size-12 text-muted-foreground/30" aria-hidden="true" />
            <h2 className="text-lg font-medium">No current membership</h2>
            <p className="mt-2 max-w-sm text-muted-foreground">Sell a plan to activate access or schedule a renewal.</p>
            {canManage && <Button className="mt-5 min-h-11" onClick={() => setCreateOpen(true)}>Sell Membership</Button>}
          </CardContent>
        </Card>
      )}

      {current && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Membership timeline</CardTitle></CardHeader>
          <CardContent><MembershipTimeline membership={current} events={events} /></CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-lg">Past and scheduled memberships</CardTitle></CardHeader>
        <CardContent className="p-0">
          {previous.length === 0 ? <p className="p-8 text-center text-sm text-muted-foreground">No other memberships found.</p> : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Plan</TableHead><TableHead>Start date</TableHead><TableHead>End date</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>{previous.map(item => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.plan?.name ?? 'Unknown plan'}</TableCell>
                    <TableCell>{formatDate(item.start_date)}</TableCell>
                    <TableCell>{formatDate(item.end_date)}</TableCell>
                    <TableCell><MembershipStatusBadge status={item.status} /></TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <CreateMembershipModal open={createOpen} onOpenChange={setCreateOpen} member={member} onSuccess={load} />
      {current && <>
        <FreezeMembershipModal open={freezeOpen} onOpenChange={setFreezeOpen} membership={current} onSuccess={load} />
        <ExtendMembershipModal open={extendOpen} onOpenChange={setExtendOpen} membership={current} onSuccess={load} />
        <CancelMembershipModal open={cancelOpen} onOpenChange={setCancelOpen} membership={current} onSuccess={load} />
      </>}
    </div>
  )
}
