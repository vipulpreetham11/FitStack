import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, CreditCard, Users, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import TeamPage from '@/components/team/TeamPage'
import SuperAdminHeader from '@/components/super-admin/SuperAdminHeader'
import ReportMetric from '@/components/reports/ReportMetric'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useSuperAdmin, type SuperGymDetail } from '@/hooks/useSuperAdmin'
import { formatCurrency, formatDate } from '@/lib/format'

export default function GymDetailPage() {
  const { gymId = '' } = useParams()
  const { getGymDetail, setGymActive } = useSuperAdmin()
  const [detail, setDetail] = useState<SuperGymDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    getGymDetail(gymId)
      .then(data => { if (active) setDetail(data) })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Could not load gym') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [getGymDetail, gymId])

  async function toggleGym() {
    if (!detail) return
    try {
      const next = !detail.gym.is_active
      await setGymActive(detail.gym.id, next)
      setDetail({ ...detail, gym: { ...detail.gym, is_active: next } })
      toast.success(next ? 'Gym activated' : 'Gym deactivated')
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Could not update gym')
    }
  }

  return (
    <div className="min-h-dvh bg-muted/20">
      <SuperAdminHeader />
      <main className="mx-auto max-w-7xl space-y-6 p-5 sm:p-8 lg:p-10">
        <Button nativeButton={false} variant="ghost" render={<Link to="/super-admin"><ArrowLeft /> All gyms</Link>} />
        {loading && <p role="status" className="py-20 text-center text-muted-foreground">Loading gym…</p>}
        {error && <div role="alert" className="rounded-lg border border-destructive/30 p-4 text-destructive">{error}</div>}
        {detail && (
          <>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-center gap-4">
                <div className="grid size-14 place-items-center rounded-xl border bg-background font-semibold" style={{ borderColor: detail.gym.brand_color }}>{detail.gym.name.slice(0, 2).toUpperCase()}</div>
                <div>
                  <h1 className="text-3xl font-semibold tracking-tight">{detail.gym.name}</h1>
                  <p className="text-muted-foreground">/{detail.gym.slug} · {detail.gym.city || 'Location not set'}</p>
                </div>
              </div>
              <Button variant={detail.gym.is_active ? 'outline' : 'default'} onClick={() => void toggleGym()}>
                {detail.gym.is_active ? <XCircle /> : <CheckCircle2 />}
                {detail.gym.is_active ? 'Deactivate gym' : 'Activate gym'}
              </Button>
            </div>

            <Tabs defaultValue="overview">
              <TabsList className="max-w-full overflow-x-auto">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="members">Members</TabsTrigger>
                <TabsTrigger value="team">Team</TabsTrigger>
                <TabsTrigger value="financials">Financials</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-4">
                <div className="grid gap-6 lg:grid-cols-2">
                  <Card>
                    <CardHeader><CardTitle>Gym information</CardTitle></CardHeader>
                    <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
                      {[
                        ['Status', detail.gym.is_active ? 'Active' : 'Inactive'],
                        ['Created', formatDate(detail.gym.created_at)],
                        ['Phone', detail.gym.phone || '—'],
                        ['Email', detail.gym.email || '—'],
                        ['GSTIN', detail.gym.gstin || 'Not registered'],
                        ['Razorpay', detail.gym.razorpay_configured ? 'Configured' : 'Not configured'],
                      ].map(([label, value]) => <div key={label}><p className="text-muted-foreground">{label}</p><p className="font-medium">{value}</p></div>)}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader><CardTitle>Brand and address</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center gap-3"><span className="size-10 rounded-full border" style={{ background: detail.gym.brand_color }} /><code className="text-sm">{detail.gym.brand_color}</code></div>
                      <p className="text-sm text-muted-foreground">{[detail.gym.address, detail.gym.city, detail.gym.state, detail.gym.pincode].filter(Boolean).join(', ') || 'No address configured'}</p>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="members" className="mt-4">
                <Card><CardContent className="p-0"><div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Code</TableHead><TableHead>Role</TableHead><TableHead>Phone</TableHead><TableHead>Status</TableHead><TableHead>Joined</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {detail.members.map(member => <TableRow key={member.id}><TableCell className="font-medium">{member.full_name}</TableCell><TableCell>{member.member_code || '—'}</TableCell><TableCell className="capitalize">{member.role}</TableCell><TableCell>{member.phone || '—'}</TableCell><TableCell><Badge variant={member.is_active ? 'default' : 'secondary'}>{member.is_active ? 'Active' : 'Inactive'}</Badge></TableCell><TableCell>{formatDate(member.joined_at)}</TableCell></TableRow>)}
                      {!detail.members.length && <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">No members found.</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </div></CardContent></Card>
              </TabsContent>

              <TabsContent value="team" className="mt-4">
                <TeamPage gymId={detail.gym.id} gymName={detail.gym.name} isSuperAdmin />
              </TabsContent>

              <TabsContent value="financials" className="mt-4 space-y-6">
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                  <ReportMetric label="Revenue this month" value={formatCurrency(detail.financials.revenue_this_month)} icon={CreditCard} loading={false} />
                  <ReportMetric label="Captured" value={detail.financials.captured_payments} icon={CheckCircle2} loading={false} />
                  <ReportMetric label="Pending" value={detail.financials.pending_payments} icon={Users} loading={false} />
                  <ReportMetric label="Failed" value={detail.financials.failed_payments} icon={XCircle} loading={false} />
                </div>
                <Card><CardHeader><CardTitle>Recent payments</CardTitle></CardHeader><CardContent className="p-0"><div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Member</TableHead><TableHead>Description</TableHead><TableHead>Total</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {detail.recent_payments.map(payment => <TableRow key={payment.id}><TableCell>{formatDate(payment.created_at)}</TableCell><TableCell>{payment.member_name}</TableCell><TableCell>{payment.description || 'Membership'}</TableCell><TableCell className="font-semibold">{formatCurrency(Number(payment.total_amount))}</TableCell><TableCell><Badge variant="secondary" className="capitalize">{payment.status}</Badge></TableCell></TableRow>)}
                      {!detail.recent_payments.length && <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">No payments found.</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </div></CardContent></Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </main>
    </div>
  )
}
