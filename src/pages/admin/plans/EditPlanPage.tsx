import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { PlanForm, planValuesToInput, type PlanFormValues } from '@/components/plans/PlanForm'
import { Skeleton } from '@/components/ui/skeleton'
import { usePlans, type MembershipPlan } from '@/hooks/usePlans'

export default function EditPlanPage() {
  const { planId } = useParams<{ planId: string }>()
  const navigate = useNavigate()
  const { getPlan, updatePlan } = usePlans()
  const [plan, setPlan] = useState<MembershipPlan | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let alive = true
    if (!planId) return
    getPlan(planId).then(data => {
      if (alive) setPlan(data)
    }).catch(cause => {
      if (alive) setError(cause instanceof Error ? cause.message : 'Could not load plan')
    })
    return () => { alive = false }
  }, [getPlan, planId])

  async function submit(values: PlanFormValues) {
    if (!planId) return
    setSubmitting(true)
    try {
      const input = planValuesToInput(values)
      delete input.is_active
      await updatePlan(planId, input)
      toast.success('Membership plan updated')
      navigate('/admin/plans')
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Could not update plan')
    } finally {
      setSubmitting(false)
    }
  }

  if (error) return <div role="alert" className="rounded-lg border border-destructive/30 p-6 text-destructive">{error}</div>
  if (!plan) return <div className="space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-[520px]" /></div>
  return <PlanForm plan={plan} title="Edit membership plan" description="Changes apply to future sales only. Existing memberships keep their original dates and terms." submitLabel="Save changes" submitting={submitting} onSubmit={submit} />
}
