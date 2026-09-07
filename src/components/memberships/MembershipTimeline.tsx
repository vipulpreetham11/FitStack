import { CalendarPlus, CircleCheck, Clock3, Play, Snowflake, XCircle } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { eventDetails, type Membership, type MembershipEvent } from '@/hooks/useMemberships'
import { formatDate } from '@/lib/format'

const eventLabels: Record<string, string> = {
  created: 'Created',
  activated: 'Activated',
  frozen: 'Frozen',
  resumed: 'Resumed',
  extended: 'Extended',
  cancelled: 'Cancelled',
  expired: 'Expired',
  upgraded: 'Upgraded',
  holiday_extended: 'Holiday extension',
}

function EventIcon({ type }: { type: string }) {
  if (type === 'frozen') return <Snowflake aria-hidden="true" />
  if (type === 'resumed' || type === 'activated') return <Play aria-hidden="true" />
  if (type === 'extended' || type === 'holiday_extended') return <CalendarPlus aria-hidden="true" />
  if (type === 'cancelled' || type === 'expired') return <XCircle aria-hidden="true" />
  return <CircleCheck aria-hidden="true" />
}

function detailText(event: MembershipEvent) {
  const details = eventDetails(event.details)
  const parts: string[] = []
  if (typeof details.days === 'number') parts.push(`${details.days > 0 && event.event_type === 'extended' ? '+' : ''}${details.days} days`)
  if (typeof details.reason === 'string' && details.reason) parts.push(`“${details.reason}”`)
  if (details.resumed_early === true) {
    const actual = typeof details.actual_days === 'number' ? details.actual_days : 0
    const planned = typeof details.planned_days === 'number' ? details.planned_days : 0
    parts.push(`Early (${actual} of ${planned} days used)`)
  }
  return parts.join(' · ')
}

export function MembershipTimeline({ membership, events, loading }: { membership: Membership; events: MembershipEvent[]; loading?: boolean }) {
  if (loading) return <div className="space-y-3">{[0, 1, 2].map(item => <Skeleton key={item} className="h-14" />)}</div>
  return (
    <ol aria-label="Membership timeline" className="space-y-0">
      {events.map((event, index) => {
        const actor = event.actor?.profiles?.full_name
        const details = detailText(event)
        return (
          <li key={event.id} className="relative grid grid-cols-[2rem_1fr] gap-3 pb-6">
            {index < events.length - 1 && <span className="absolute left-[15px] top-8 h-full w-px bg-border" aria-hidden="true" />}
            <span className="relative z-10 flex size-8 items-center justify-center rounded-full border bg-background text-primary [&_svg]:size-4">
              <EventIcon type={event.event_type} />
            </span>
            <div className="pt-1">
              <p className="font-medium">{eventLabels[event.event_type] ?? event.event_type}</p>
              <p className="text-sm text-muted-foreground">
                {formatDate(event.created_at)}
                {actor ? ` · by ${actor}` : ''}
                {details ? ` · ${details}` : ''}
              </p>
            </div>
          </li>
        )
      })}
      {!['cancelled', 'expired'].includes(membership.status) && (
        <li className="grid grid-cols-[2rem_1fr] gap-3">
          <span className="flex size-8 items-center justify-center rounded-full border border-dashed bg-background text-muted-foreground"><Clock3 className="size-4" aria-hidden="true" /></span>
          <div className="pt-1">
            <p className="font-medium">Expires</p>
            <p className="text-sm text-muted-foreground">{formatDate(membership.end_date)}</p>
          </div>
        </li>
      )}
      {events.length === 0 && <li className="text-sm text-muted-foreground">No lifecycle events recorded yet.</li>}
    </ol>
  )
}
