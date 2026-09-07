import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { usePlans } from '@/hooks/usePlans'
import { toDateOnly } from '@/lib/membership'
import type { PromoCode, PromoInput } from '@/hooks/usePromos'

const promoSchema = z.object({
  code: z.string().trim().min(3, 'Code must be at least 3 characters').regex(/^[A-Z0-9-]+$/, 'Use uppercase letters, numbers, and hyphens only'),
  discount_type: z.enum(['percentage', 'flat']),
  discount_value: z.number({ error: 'Enter a discount value' }).positive('Discount must be greater than 0'),
  max_discount_amount: z.union([z.number().positive('Cap must be greater than 0'), z.nan()]),
  max_uses: z.union([z.number().int().positive('Maximum uses must be at least 1'), z.nan()]),
  valid_from: z.string().min(1, 'Choose a start date'),
  valid_until: z.string(),
  applicable_plan_ids: z.array(z.string()),
}).superRefine((values, context) => {
  if (values.discount_type === 'percentage' && values.discount_value > 100) context.addIssue({ code: 'custom', path: ['discount_value'], message: 'Percentage cannot exceed 100' })
  if (values.valid_until && values.valid_from > values.valid_until) context.addIssue({ code: 'custom', path: ['valid_until'], message: 'End date must be after the start date' })
})

export type PromoFormValues = z.infer<typeof promoSchema>

function datePart(value: string | null) { return value ? toDateOnly(new Date(value)) : '' }

function defaults(promo?: PromoCode): PromoFormValues {
  return {
    code: promo?.code ?? '',
    discount_type: (promo?.discount_type as 'percentage' | 'flat') ?? 'percentage',
    discount_value: Number(promo?.discount_value ?? 10),
    max_discount_amount: promo?.max_discount_amount === null || promo?.max_discount_amount === undefined ? Number.NaN : Number(promo.max_discount_amount),
    max_uses: promo?.max_uses === null || promo?.max_uses === undefined ? Number.NaN : promo.max_uses,
    valid_from: datePart(promo?.valid_from ?? null) || toDateOnly(),
    valid_until: datePart(promo?.valid_until ?? null),
    applicable_plan_ids: Array.isArray(promo?.applicable_plan_ids) ? promo.applicable_plan_ids.filter((id): id is string => typeof id === 'string') : [],
  }
}

export function promoValuesToInput(values: PromoFormValues): PromoInput {
  return {
    code: values.code.trim().toUpperCase(), discount_type: values.discount_type, discount_value: values.discount_value,
    max_discount_amount: values.discount_type === 'percentage' && Number.isFinite(values.max_discount_amount) ? values.max_discount_amount : null,
    max_uses: Number.isFinite(values.max_uses) ? values.max_uses : null,
    valid_from: `${values.valid_from}T00:00:00+05:30`, valid_until: values.valid_until ? `${values.valid_until}T23:59:59.999+05:30` : null,
    applicable_plan_ids: values.applicable_plan_ids.length > 0 ? values.applicable_plan_ids : null, is_active: true,
  }
}

export function PromoForm({ promo, submitting, onSubmit }: { promo?: PromoCode; submitting: boolean; onSubmit: (values: PromoFormValues) => Promise<void> }) {
  const { activePlans, loading: plansLoading } = usePlans()
  const form = useForm<PromoFormValues>({ resolver: zodResolver(promoSchema), defaultValues: defaults(promo) })
  const type = form.watch('discount_type')
  const selectedPlans = form.watch('applicable_plan_ids')

  return <div className="mx-auto max-w-3xl space-y-6 pb-12">
    <div><h1 className="text-3xl font-semibold tracking-tight">{promo ? 'Edit promo code' : 'Create promo code'}</h1><p className="mt-2 text-muted-foreground">Control the discount, availability window, usage limit, and eligible plans.</p></div>
    <Card><CardHeader><CardTitle>Promotion details</CardTitle><CardDescription>Discounts are applied before GST and revalidated securely at checkout.</CardDescription></CardHeader><CardContent>
      <Form {...form}><form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField control={form.control} name="code" render={({ field }) => <FormItem><FormLabel>Promo code *</FormLabel><FormControl><Input autoComplete="off" placeholder="WELCOME50" {...field} onChange={event => field.onChange(event.target.value.toUpperCase().replace(/\s/g, ''))} /></FormControl><FormMessage /></FormItem>} />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField control={form.control} name="discount_type" render={({ field }) => <FormItem><FormLabel>Discount type *</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="percentage">Percentage</SelectItem><SelectItem value="flat">Flat amount</SelectItem></SelectContent></Select><FormMessage /></FormItem>} />
          <FormField control={form.control} name="discount_value" render={({ field }) => <FormItem><FormLabel>{type === 'percentage' ? 'Percentage discount *' : 'Discount amount (₹) *'}</FormLabel><FormControl><Input type="number" min="0.01" max={type === 'percentage' ? 100 : undefined} step="0.01" inputMode="decimal" {...field} onChange={event => field.onChange(event.target.valueAsNumber)} /></FormControl><FormMessage /></FormItem>} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {type === 'percentage' && <FormField control={form.control} name="max_discount_amount" render={({ field }) => <FormItem><FormLabel>Maximum discount cap (₹)</FormLabel><FormControl><Input type="number" min="0.01" step="0.01" inputMode="decimal" placeholder="No cap" {...field} value={Number.isNaN(field.value) ? '' : field.value} onChange={event => field.onChange(event.target.value === '' ? Number.NaN : event.target.valueAsNumber)} /></FormControl><FormMessage /></FormItem>} />}
          <FormField control={form.control} name="max_uses" render={({ field }) => <FormItem><FormLabel>Maximum uses</FormLabel><FormControl><Input type="number" min="1" step="1" inputMode="numeric" placeholder="Unlimited" {...field} value={Number.isNaN(field.value) ? '' : field.value} onChange={event => field.onChange(event.target.value === '' ? Number.NaN : event.target.valueAsNumber)} /></FormControl><FormMessage /></FormItem>} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField control={form.control} name="valid_from" render={({ field }) => <FormItem><FormLabel>Valid from *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>} />
          <FormField control={form.control} name="valid_until" render={({ field }) => <FormItem><FormLabel>Valid until</FormLabel><FormControl><Input type="date" min={form.watch('valid_from')} {...field} /></FormControl><FormMessage /></FormItem>} />
        </div>
        <fieldset className="space-y-3 rounded-lg border p-4"><legend className="px-1 text-sm font-medium">Applicable plans</legend><p className="text-sm text-muted-foreground">Leave every plan unchecked to make this promo valid for all plans.</p>
          {plansLoading ? <p role="status" className="text-sm text-muted-foreground">Loading plans…</p> : activePlans.length === 0 ? <p className="text-sm text-muted-foreground">No active plans available.</p> : <div className="grid gap-2 sm:grid-cols-2">{activePlans.map(plan => <label key={plan.id} className="flex min-h-11 items-center gap-3 rounded-md border px-3 py-2 text-sm"><Checkbox checked={selectedPlans.includes(plan.id)} onCheckedChange={checked => {
            const current = form.getValues('applicable_plan_ids'); form.setValue('applicable_plan_ids', checked ? [...current, plan.id] : current.filter(id => id !== plan.id), { shouldDirty: true })
          }} /><span>{plan.name}</span></label>)}</div>}
        </fieldset>
        <div className="flex flex-col-reverse gap-2 border-t pt-6 sm:flex-row sm:justify-end"><Button nativeButton={false} type="button" variant="outline" render={<Link to="/admin/promos">Cancel</Link>} /><Button type="submit" disabled={submitting}>{submitting ? 'Saving…' : promo ? 'Save changes' : 'Create promo code'}</Button></div>
      </form></Form>
    </CardContent></Card>
  </div>
}
