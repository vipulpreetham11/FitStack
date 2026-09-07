import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, TicketPercent } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { usePlans } from '@/hooks/usePlans'
import { usePromos, type PromoCode } from '@/hooks/usePromos'
import { applicablePlanIds } from '@/lib/promo'
import { formatCurrency, formatDate } from '@/lib/format'

function promoState(promo: PromoCode) {
  if (promo.valid_until && new Date(promo.valid_until).getTime() < Date.now()) return { label: 'Expired', className: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/60 dark:text-red-300' }
  if (!promo.is_active) return { label: 'Inactive', className: 'bg-muted text-muted-foreground' }
  return { label: 'Active', className: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300' }
}

export default function PromoListPage() {
  const { promos, loading, error, togglePromoActive } = usePromos()
  const { plans } = usePlans()
  const [busyId, setBusyId] = useState<string | null>(null)
  const names = new Map(plans.map(plan => [plan.id, plan.name]))

  async function toggle(promo: PromoCode) {
    setBusyId(promo.id)
    try { await togglePromoActive(promo.id, !promo.is_active); toast.success(`Promo code ${promo.is_active ? 'deactivated' : 'activated'}`) }
    catch (cause) { toast.error(cause instanceof Error ? cause.message : 'Could not update promo code') }
    finally { setBusyId(null) }
  }

  return <div className="space-y-6 pb-12">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h1 className="text-3xl font-semibold tracking-tight">Promo codes</h1><p className="mt-2 text-muted-foreground">Create targeted discounts and track redemption limits.</p></div><Button nativeButton={false} render={<Link to="/admin/promos/new"><Plus aria-hidden="true" /> Create Promo Code</Link>} /></div>
    {error && <div role="alert" className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive">{error}</div>}
    {loading ? <div className="space-y-3">{[0, 1, 2].map(item => <Skeleton key={item} className="h-16" />)}</div> : promos.length === 0 ? <Card className="border-dashed"><CardContent className="flex flex-col items-center py-14 text-center"><TicketPercent className="mb-4 size-12 text-muted-foreground/30" aria-hidden="true" /><h2 className="text-lg font-medium">No promo codes yet</h2><p className="mt-2 text-muted-foreground">Create your first promotion for plan checkout.</p><Button nativeButton={false} className="mt-5" render={<Link to="/admin/promos/new">Create promo code</Link>} /></CardContent></Card> : <Card><CardContent className="p-0"><div className="overflow-x-auto"><Table>
      <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Discount</TableHead><TableHead>Cap</TableHead><TableHead>Usage</TableHead><TableHead>Valid period</TableHead><TableHead>Plans</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
      <TableBody>{promos.map(promo => {
        const status = promoState(promo); const ids = applicablePlanIds(promo.applicable_plan_ids)
        const planLabel = promo.applicable_plan_ids === null ? 'All Plans' : ids.map(id => names.get(id) ?? 'Unknown plan').join(', ') || 'No plans'
        return <TableRow key={promo.id}><TableCell className="font-mono font-semibold">{promo.code}</TableCell><TableCell><Badge variant="secondary">{promo.discount_type === 'percentage' ? `${promo.discount_value}%` : `${formatCurrency(Number(promo.discount_value))} off`}</Badge></TableCell><TableCell>{promo.discount_type === 'percentage' && promo.max_discount_amount !== null ? formatCurrency(Number(promo.max_discount_amount)) : '—'}</TableCell><TableCell className="tabular-nums">{promo.used_count} / {promo.max_uses ?? '∞'}</TableCell><TableCell className="whitespace-nowrap">{formatDate(promo.valid_from)} — {promo.valid_until ? formatDate(promo.valid_until) : 'No expiry'}</TableCell><TableCell className="max-w-56"><span className="line-clamp-2" title={planLabel}>{planLabel}</span></TableCell><TableCell><Badge variant="outline" className={status.className}>{status.label}</Badge></TableCell><TableCell><div className="flex justify-end gap-2"><Button nativeButton={false} variant="outline" size="sm" render={<Link to={`/admin/promos/${promo.id}/edit`}>Edit</Link>} /><Button variant={promo.is_active ? 'destructive' : 'default'} size="sm" disabled={busyId === promo.id} onClick={() => void toggle(promo)}>{promo.is_active ? 'Deactivate' : 'Activate'}</Button></div></TableCell></TableRow>
      })}</TableBody>
    </Table></div></CardContent></Card>}
  </div>
}
