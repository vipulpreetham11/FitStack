import { Link } from 'react-router-dom'
import { Users, TrendingUp, Clock, BadgeDollarSign, AlertTriangle, Activity, UserPlus, CreditCard, Snowflake, XCircle } from 'lucide-react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { formatDistanceToNow } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { useDashboard } from '@/hooks/useDashboard'
import { formatCurrency, formatDate } from '@/lib/format'
import { useGym } from '@/hooks/useGym'

function MetricCard({ label, value, icon: Icon, accent, loading, warning }: { label: string; value: number | string; icon: React.ElementType; accent?: string; loading: boolean; warning?: boolean }) {
  return (
    <Card className={warning && Number(value) > 0 ? 'border-orange-300 dark:border-orange-800' : ''}>
      <CardContent className="pt-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm text-muted-foreground">{label}</p>
          <Icon className={`h-4 w-4 ${accent ?? 'text-muted-foreground'}`} />
        </div>
        {loading ? <Skeleton className="h-8 w-16" /> : (
          <p className={`text-3xl font-bold ${warning && Number(value) > 0 ? 'text-orange-600 dark:text-orange-400' : ''}`}>{value}</p>
        )}
      </CardContent>
    </Card>
  )
}

const ACTIVITY_ICONS = { checkin: Clock, payment: CreditCard, new_member: UserPlus }
const ACTIVITY_COLORS = { checkin: 'text-emerald-600', payment: 'text-sky-600', new_member: 'text-purple-600' }

function shortDate(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
}

export default function DashboardPage() {
  const { gym } = useGym()
  const {
    liveHeadcount, activeMembers, expiringSoon, revenueThisMonth,
    revenueByDay, attendanceByDay, recentActivity,
    newMembersThisMonth, membershipsSoldThisMonth, failedPayments, frozenMembers,
    loading, error,
  } = useDashboard()

  const brandColor = gym?.brand_color ?? '#171717'

  return (
    <div className="space-y-8 pb-10">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Overview</h1>
        <p className="mt-1 text-muted-foreground">Live dashboard for {gym?.name ?? 'your gym'}</p>
      </div>

      {error && <div role="alert" className="rounded-lg border border-destructive/30 p-3 text-destructive text-sm">{error}</div>}

      {/* Row 1 — Key metrics */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label="Currently in gym" value={liveHeadcount} icon={Users} accent="text-emerald-600" loading={loading} />
        <MetricCard label="Active members" value={activeMembers} icon={TrendingUp} accent="text-sky-600" loading={loading} />
        <MetricCard label="Expiring in 7 days" value={expiringSoon.length} icon={AlertTriangle} accent="text-orange-600" loading={loading} warning />
        <MetricCard label="Revenue this month" value={loading ? '—' : formatCurrency(revenueThisMonth)} icon={BadgeDollarSign} accent="text-violet-600" loading={loading} />
      </div>

      {/* Row 2 — Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Revenue — Last 30 Days</CardTitle></CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-48" /> : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={revenueByDay}>
                  <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11 }} interval={6} />
                  <YAxis tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} width={48} />
                  <Tooltip formatter={(v: any) => [formatCurrency(Number(v)), 'Revenue']} labelFormatter={(l: any) => shortDate(String(l))} />
                  <Line type="monotone" dataKey="amount" stroke={brandColor} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Check-ins — Last 14 Days</CardTitle></CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-48" /> : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={attendanceByDay}>
                  <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11 }} interval={3} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={30} />
                  <Tooltip formatter={(v: any) => [v, 'Check-ins']} labelFormatter={(l: any) => shortDate(String(l))} />
                  <Bar dataKey="count" fill={brandColor} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 3 — Lists */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Expiring soon */}
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />Expiring Soon
            </CardTitle>
            <Button nativeButton={false} variant="ghost" size="sm" render={<Link to="/admin/memberships">View all</Link>} />
          </CardHeader>
          <CardContent className="p-0">
            {loading ? <div className="p-4 space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
              : expiringSoon.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">No memberships expiring soon. 🎉</p>
              ) : expiringSoon.map(m => {
                const name = m.member?.profiles?.full_name ?? 'Unknown'
                const plan = m.plan?.name ?? 'Unknown plan'
                const days = Math.max(0, Math.ceil((new Date(m.end_date).getTime() - Date.now()) / 86400000))
                return (
                  <div key={m.id} className="flex items-center justify-between px-4 py-3 border-b last:border-0">
                    <div>
                      <p className="font-medium text-sm">{name}</p>
                      <p className="text-xs text-muted-foreground">{plan} · Expires {formatDate(m.end_date)}</p>
                    </div>
                    <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300 shrink-0">{days}d left</Badge>
                  </div>
                )
              })}
          </CardContent>
        </Card>

        {/* Recent activity */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-sky-500" />Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? <div className="p-4 space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
              : recentActivity.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">No recent activity.</p>
              ) : recentActivity.slice(0, 10).map(item => {
                const Icon = ACTIVITY_ICONS[item.type]
                const color = ACTIVITY_COLORS[item.type]
                const ago = formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })
                return (
                  <div key={item.id} className="flex items-start gap-3 px-4 py-3 border-b last:border-0">
                    <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${color}`} />
                    <div className="min-w-0">
                      <p className="text-sm truncate">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{ago}</p>
                    </div>
                  </div>
                )
              })}
          </CardContent>
        </Card>
      </div>

      {/* Row 4 — Quick summary */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label="New members this month" value={newMembersThisMonth} icon={UserPlus} accent="text-purple-600" loading={loading} />
        <MetricCard label="Memberships sold" value={membershipsSoldThisMonth} icon={CreditCard} accent="text-sky-600" loading={loading} />
        <MetricCard label="Failed payments" value={failedPayments} icon={XCircle} accent="text-red-600" loading={loading} />
        <MetricCard label="Frozen members" value={frozenMembers} icon={Snowflake} accent="text-indigo-600" loading={loading} />
      </div>
    </div>
  )
}