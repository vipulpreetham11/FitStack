import { Check, Snowflake } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { calculateGST } from '@/lib/gst'
import { durationLabel, jsonStrings } from '@/lib/membership'
import { formatCurrency } from '@/lib/format'
import type { MembershipPlan } from '@/hooks/usePlans'

type Props = {
  plan: MembershipPlan
  discountAmount?: number
  management?: boolean
  busy?: boolean
  onToggle?: (plan: MembershipPlan) => void
  onBuy?: (plan: MembershipPlan) => void
}

function freezePolicy(plan: MembershipPlan) {
  if (plan.max_freezes === 0) return 'No freezing allowed'
  const count = plan.max_freezes === null ? 'Unlimited freezes' : `Max ${plan.max_freezes} freeze${plan.max_freezes === 1 ? '' : 's'}`
  const days = plan.max_freeze_days === null ? 'unlimited days each' : `${plan.max_freeze_days} days each`
  return `${count}, ${days}`
}

export function PlanCard({ plan, discountAmount = 0, management, busy, onToggle, onBuy }: Props) {
  const gst = calculateGST(Number(plan.price), Math.min(Number(plan.price), discountAmount))
  const features = jsonStrings(plan.features)
  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <CardHeader className="gap-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-xl">{plan.name}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">{durationLabel(plan.duration_type, plan.duration_value)}</p>
          </div>
          {management && (
            <Badge variant="outline" className={plan.is_active ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-muted text-muted-foreground'}>
              {plan.is_active ? 'Active' : 'Inactive'}
            </Badge>
          )}
        </div>
        <div className="rounded-lg bg-muted/50 p-4">
          {discountAmount > 0 && <p className="text-sm text-muted-foreground line-through">{formatCurrency(Number(plan.price))}</p>}
          <p className="text-2xl font-semibold tabular-nums">{formatCurrency(gst.taxableAmount)}</p>
          <p className="text-sm text-muted-foreground">+ {formatCurrency(gst.cgstAmount + gst.sgstAmount)} GST (5%)</p>
          <p className="mt-2 border-t pt-2 font-semibold tabular-nums">Total {formatCurrency(gst.totalAmount)}</p>
        </div>
      </CardHeader>
      <CardContent className="flex-1 space-y-4">
        {features.length > 0 ? (
          <ul className="space-y-2">
            {features.map((feature, index) => (
              <li key={`${feature}-${index}`} className="flex gap-2 text-sm">
                <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden="true" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted-foreground">Core gym access included.</p>}
        <div className="flex gap-2 rounded-lg border p-3 text-sm text-muted-foreground">
          <Snowflake className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{freezePolicy(plan)}</span>
        </div>
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2 border-t">
        {management ? (
          <>
            <Button nativeButton={false} variant="outline" render={<Link to={`/admin/plans/${plan.id}/edit`}>Edit plan</Link>} />
            <Button variant={plan.is_active ? 'destructive' : 'default'} disabled={busy} onClick={() => onToggle?.(plan)}>
              {plan.is_active ? 'Deactivate' : 'Activate'}
            </Button>
          </>
        ) : (
          <Button className="w-full min-h-11" onClick={() => onBuy?.(plan)}>Buy Now</Button>
        )}
      </CardFooter>
    </Card>
  )
}
