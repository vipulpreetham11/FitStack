import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { PlanCard } from '@/components/plans/PlanCard'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { usePlans } from '@/hooks/usePlans'
import { useGym } from '@/hooks/useGym'

export default function PlanListPage() {
  const { plans, loading, error, togglePlanActive } = usePlans()
  const { hasPermission } = useGym()
  const [busyId, setBusyId] = useState<string | null>(null)
  const canManage = hasPermission('plans.manage')

  async function toggle(id: string, isActive: boolean) {
    setBusyId(id)
    try {
      await togglePlanActive(id, isActive)
      toast.success(isActive ? 'Plan activated' : 'Plan deactivated')
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Could not update plan')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Membership plans</h1>
          <p className="mt-2 text-muted-foreground">Build and manage the plans your gym offers.</p>
        </div>
        {canManage && <Button nativeButton={false} className="min-h-11" render={<Link to="/admin/plans/new"><Plus aria-hidden="true" /> Create New Plan</Link>} />}
      </div>
      {error && <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error}</div>}
      {loading ? (
        <div className="grid gap-5 md:grid-cols-2">{[0, 1].map(item => <Skeleton key={item} className="h-[420px]" />)}</div>
      ) : plans.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center py-14 text-center">
            <h2 className="text-lg font-medium">No plans yet</h2>
            <p className="mt-2 max-w-md text-muted-foreground">Create your first membership plan to start selling memberships.</p>
            {canManage && <Button nativeButton={false} className="mt-5 min-h-11" render={<Link to="/admin/plans/new">Create a plan</Link>} />}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {plans.map(plan => <PlanCard key={plan.id} plan={plan} management busy={busyId === plan.id} onToggle={item => void toggle(item.id, !item.is_active)} />)}
        </div>
      )}
    </div>
  )
}
