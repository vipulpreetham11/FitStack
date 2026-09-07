import { Link } from 'react-router-dom'
import { Building2, IndianRupee, Users, Zap } from 'lucide-react'
import { toast } from 'sonner'
import SuperAdminHeader from '@/components/super-admin/SuperAdminHeader'
import ReportMetric from '@/components/reports/ReportMetric'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useSuperAdmin } from '@/hooks/useSuperAdmin'
import { formatCurrency, formatDate } from '@/lib/format'

export default function GymListPage() {
  const { gyms, loading, error, setGymActive, platformStats } = useSuperAdmin()
  const toggle = async (id: string, active: boolean) => { try { await setGymActive(id, active); toast.success(active ? 'Gym activated' : 'Gym deactivated') } catch (caught) { toast.error(caught instanceof Error ? caught.message : 'Could not update gym') } }
  return <div className="min-h-dvh bg-muted/20"><SuperAdminHeader /><main className="mx-auto max-w-7xl space-y-6 p-5 sm:p-8 lg:p-10"><div><p className="text-sm font-medium text-muted-foreground">Platform administration</p><h1 className="text-3xl font-semibold tracking-tight">Gyms</h1><p className="mt-1 text-muted-foreground">Tenant health, memberships, and monthly revenue at a glance.</p></div>{error && <div role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">{error}. Apply the Module 16–18 SQL before using live super-admin data.</div>}
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4"><ReportMetric label="Total gyms" value={platformStats.totalGyms} icon={Building2} loading={loading} /><ReportMetric label="Active gyms" value={platformStats.activeGyms} icon={Zap} loading={loading} /><ReportMetric label="Total members" value={platformStats.totalMembers} icon={Users} loading={loading} /><ReportMetric label="Platform revenue" value={formatCurrency(platformStats.platformRevenue)} icon={IndianRupee} loading={loading} /></div>
    <Card><CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Gym</TableHead><TableHead>Slug</TableHead><TableHead>City</TableHead><TableHead>Status</TableHead><TableHead>Members</TableHead><TableHead>Active memberships</TableHead><TableHead>Revenue this month</TableHead><TableHead>Created</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader><TableBody>{gyms.map(gym => <TableRow key={gym.id}><TableCell className="font-medium">{gym.name}</TableCell><TableCell className="font-mono text-xs">{gym.slug}</TableCell><TableCell>{gym.city || '—'}</TableCell><TableCell><Badge variant={gym.is_active ? 'default' : 'secondary'}>{gym.is_active ? 'Active' : 'Inactive'}</Badge></TableCell><TableCell>{gym.members_count}</TableCell><TableCell>{gym.active_memberships}</TableCell><TableCell className="font-semibold">{formatCurrency(gym.revenue_this_month)}</TableCell><TableCell>{formatDate(gym.created_at)}</TableCell><TableCell><div className="flex gap-2"><Button nativeButton={false} variant="outline" size="sm" render={<Link to={`/super-admin/gyms/${gym.id}`}>View</Link>} /><Button variant="ghost" size="sm" onClick={() => void toggle(gym.id, !gym.is_active)}>{gym.is_active ? 'Deactivate' : 'Activate'}</Button></div></TableCell></TableRow>)}{!loading && !gyms.length && <TableRow><TableCell colSpan={9} className="h-28 text-center text-muted-foreground">No gyms found. Create the first tenant to get started.</TableCell></TableRow>}</TableBody></Table></div></CardContent></Card>
  </main></div>
}
