import { Link } from 'react-router-dom'
import { QrCode, CreditCard, Dumbbell, Calendar } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/useAuth'
import { useGym } from '@/hooks/useGym'
import { useMemberships } from '@/hooks/useMemberships'
import { usePayments } from '@/hooks/usePayments'
import { useAttendance } from '@/hooks/useAttendance'
import { daysRemaining, membershipProgress, toDateOnly } from '@/lib/membership'
import { formatDate, formatCurrency } from '@/lib/format'
import { MembershipStatusBadge } from '@/components/memberships/MembershipStatusBadge'

function greeting() {
  const hour = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata', hour: 'numeric', hour12: false })
  const h = parseInt(hour, 10)
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function MemberDashboard() {
  const { profile } = useAuth()
  const { gym, gymMember } = useGym()
  const { memberships, loading: memLoading } = useMemberships()
  const { payments, loading: payLoading } = usePayments()
  const { todayAttendance, loading: attLoading } = useAttendance()

  const firstName = profile?.full_name?.split(' ')[0] ?? 'there'
  const mine = memberships.filter(m => !gymMember || m.member_id === gymMember.id)
  const current = mine.find(m => ['active', 'frozen', 'scheduled'].includes(m.status)) ?? null
  const myPayments = payments.filter(p => !gymMember || p.member_id === gymMember.id)
  const recentPayments = myPayments.slice(0, 3)
  const today = toDateOnly()
  const visitsThisMonth = todayAttendance.filter(a => (!gymMember || a.member_id === gymMember.id) && a.check_in_at.slice(0, 7) === today.slice(0, 7)).length
  // Last visit from attendance (all time for this member)
  const lastVisit = todayAttendance.find(a => !gymMember || a.member_id === gymMember.id)?.check_in_at

  const progress = current ? membershipProgress(current.start_date, current.end_date) : 0
  const days = current ? daysRemaining(current.end_date) : 0
  const brandColor = gym?.brand_color ?? '#171717'

  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-10">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{greeting()}, {firstName} 👋</h1>
        <p className="text-muted-foreground text-sm mt-1">{gym?.name ?? 'Your Gym'}</p>
      </div>

      {/* Membership card */}
      {memLoading ? <Skeleton className="h-44 rounded-2xl" /> : current ? (
        <div className="rounded-2xl p-5 text-white relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${brandColor}, ${brandColor}cc)` }}>
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-sm text-white/70 font-medium uppercase tracking-wide">Membership</p>
              <p className="text-xl font-bold mt-0.5">{current.plan?.name ?? 'Plan'}</p>
            </div>
            <MembershipStatusBadge status={current.status} />
          </div>
          {/* Progress bar */}
          <div className="mb-3">
            <div className="flex justify-between text-xs text-white/70 mb-1">
              <span>{progress}% used</span>
              <span>{current.status === 'frozen' ? 'Frozen' : `${days} day${days === 1 ? '' : 's'} left`}</span>
            </div>
            <div className="h-2 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-white rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm text-white/80">
            <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />Expires {formatDate(current.end_date)}</span>
          </div>
          {current.status === 'frozen' && current.frozen_until && (
            <p className="mt-2 text-xs text-white/70">Frozen until {formatDate(current.frozen_until)}</p>
          )}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center py-10 text-center">
            <Dumbbell className="h-10 w-10 text-muted-foreground mb-3" />
            <h2 className="text-lg font-medium">No active membership</h2>
            <p className="text-sm text-muted-foreground mt-1">Browse plans to get started.</p>
            <Button nativeButton={false} className="mt-4" render={<Link to="/member/plans">Browse Plans</Link>} />
          </CardContent>
        </Card>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <Button nativeButton={false} variant="outline" className="h-16 flex-col gap-1 text-base" render={<Link to="/member/qr" className="flex flex-col items-center justify-center w-full h-full gap-1"><QrCode className="h-6 w-6" /><span className="text-sm">Show QR</span></Link>} />
        <Button nativeButton={false} variant="outline" className="h-16 flex-col gap-1 text-base" render={<Link to="/member/plans" className="flex flex-col items-center justify-center w-full h-full gap-1"><CreditCard className="h-6 w-6" /><span className="text-sm">Buy Plan</span></Link>} />
      </div>

      {/* This month stats */}
      <Card>
        <CardContent className="pt-5 space-y-3">
          <h2 className="font-semibold text-base">This Month</h2>
          {attLoading ? <Skeleton className="h-12" /> : (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Dumbbell className="h-4 w-4 text-muted-foreground" />
                <span>{visitsThisMonth} visit{visitsThisMonth === 1 ? '' : 's'}</span>
              </div>
              {lastVisit ? (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>Last visit: {formatDate(lastVisit)}</span>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No check-ins recorded yet.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent payments */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-base">Recent Payments</h2>
            <Button nativeButton={false} variant="ghost" size="sm" render={<Link to="/member/payments">View all</Link>} />
          </div>
          {payLoading ? <Skeleton className="h-20" /> : recentPayments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payments yet.</p>
          ) : (
            <div className="space-y-2">
              {recentPayments.map(p => (
                <div key={p.id} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium">{p.description ?? 'Payment'}</p>
                    <p className="text-muted-foreground text-xs">{formatDate(p.created_at)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{formatCurrency(Number(p.total_amount))}</p>
                    <p className={`text-xs ${p.status === 'captured' ? 'text-emerald-600' : p.status === 'failed' ? 'text-destructive' : 'text-muted-foreground'}`}>{p.status}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
