import { useState } from 'react'
import { PlanCard } from '@/components/plans/PlanCard'
import { PlanCheckout } from '@/components/payments/PlanCheckout'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/useAuth'
import { useGym } from '@/hooks/useGym'
import { usePlans } from '@/hooks/usePlans'
import type { MembershipPlan } from '@/hooks/usePlans'

export default function MemberPlansPage() {
  const { activePlans, loading, error } = usePlans()
  const { gymMember } = useGym()
  const { profile } = useAuth()
  const [selectedPlan, setSelectedPlan] = useState<MembershipPlan | null>(null)

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Explore plans</h1>
        <p className="mt-2 text-muted-foreground">Choose the membership that fits your routine.</p>
      </div>
      {error && <div role="alert" className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive">{error}</div>}
      {loading ? (
        <div className="grid gap-5 md:grid-cols-2">{[0, 1].map(item => <Skeleton key={item} className="h-[420px]" />)}</div>
      ) : activePlans.length === 0 ? (
        <Card className="border-dashed"><CardContent className="py-14 text-center text-muted-foreground">No plans are available right now. Please check again soon.</CardContent></Card>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {activePlans.map(plan => <PlanCard key={plan.id} plan={plan} onBuy={() => setSelectedPlan(plan)} />)}
        </div>
      )}
      {selectedPlan && gymMember && <PlanCheckout
        open
        onOpenChange={value => { if (!value) setSelectedPlan(null) }}
        initialPlan={selectedPlan}
        member={{ id: gymMember.id, name: profile?.full_name ?? 'Member', phone: profile?.phone ?? null, email: profile?.email ?? null }}
        membershipPath="/member/membership"
      />}
    </div>
  )
}
