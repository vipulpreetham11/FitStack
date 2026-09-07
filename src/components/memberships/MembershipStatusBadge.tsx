import { Badge } from '@/components/ui/badge'
import { asMembershipStatus } from '@/hooks/useMemberships'
import { membershipStatusClasses } from '@/lib/membership'

export function MembershipStatusBadge({ status }: { status: string }) {
  const normalized = asMembershipStatus(status)
  return <Badge variant="outline" className={membershipStatusClasses[normalized] ?? 'bg-muted text-muted-foreground'}>{status[0]?.toUpperCase() + status.slice(1)}</Badge>
}
