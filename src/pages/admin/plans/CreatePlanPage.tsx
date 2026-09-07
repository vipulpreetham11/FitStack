import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { PlanForm, planValuesToInput, type PlanFormValues } from '@/components/plans/PlanForm'
import { usePlans } from '@/hooks/usePlans'

export default function CreatePlanPage() {
  const navigate = useNavigate()
  const { createPlan } = usePlans()
  const [submitting, setSubmitting] = useState(false)

  async function submit(values: PlanFormValues) {
    setSubmitting(true)
    try {
      await createPlan(planValuesToInput(values))
      toast.success('Membership plan created')
      navigate('/admin/plans')
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Could not create plan')
    } finally {
      setSubmitting(false)
    }
  }

  return <PlanForm title="Create membership plan" description="Create a reusable plan for new memberships and renewals." submitLabel="Create plan" submitting={submitting} onSubmit={submit} />
}
