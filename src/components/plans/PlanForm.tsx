import { useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PlanCard } from '@/components/plans/PlanCard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import type { MembershipPlan, PlanInput } from '@/hooks/usePlans'

const planSchema = z.object({
  name: z.string().trim().min(2, 'Plan name must be at least 2 characters'),
  price: z.number({ error: 'Enter a price' }).min(0, 'Price cannot be negative'),
  duration_type: z.enum(['days', 'months', 'years']),
  duration_value: z.number({ error: 'Enter a duration' }).int().min(1, 'Duration must be at least 1'),
  features: z.array(z.object({ value: z.string() })),
  allowFreezing: z.boolean(),
  unlimitedFreezes: z.boolean(),
  max_freezes: z.number().int().min(1, 'At least 1 freeze is required'),
  unlimitedFreezeDays: z.boolean(),
  max_freeze_days: z.number().int().min(1, 'At least 1 day is required'),
  allow_future_start: z.boolean(),
  sort_order: z.number().int(),
})

export type PlanFormValues = z.infer<typeof planSchema>

function initialValues(plan?: MembershipPlan): PlanFormValues {
  return {
    name: plan?.name ?? '',
    price: Number(plan?.price ?? 0),
    duration_type: (plan?.duration_type as PlanFormValues['duration_type']) ?? 'months',
    duration_value: plan?.duration_value ?? 1,
    features: Array.isArray(plan?.features)
      ? plan.features.filter((feature): feature is string => typeof feature === 'string').map(value => ({ value }))
      : [{ value: '' }],
    allowFreezing: plan ? plan.max_freezes !== 0 : true,
    unlimitedFreezes: plan?.max_freezes === null,
    max_freezes: plan?.max_freezes && plan.max_freezes > 0 ? plan.max_freezes : 1,
    unlimitedFreezeDays: plan?.max_freeze_days === null,
    max_freeze_days: plan?.max_freeze_days ?? 7,
    allow_future_start: plan?.allow_future_start ?? true,
    sort_order: plan?.sort_order ?? 0,
  }
}

export function planValuesToInput(values: PlanFormValues): PlanInput {
  return {
    name: values.name.trim(),
    price: values.price,
    duration_type: values.duration_type,
    duration_value: values.duration_value,
    features: values.features.map(feature => feature.value.trim()).filter(Boolean),
    max_freezes: values.allowFreezing ? (values.unlimitedFreezes ? null : values.max_freezes) : 0,
    max_freeze_days: values.allowFreezing ? (values.unlimitedFreezeDays ? null : values.max_freeze_days) : null,
    allow_future_start: values.allow_future_start,
    sort_order: values.sort_order,
    is_active: true,
  }
}

type Props = {
  plan?: MembershipPlan
  title: string
  description: string
  submitLabel: string
  submitting: boolean
  onSubmit: (values: PlanFormValues) => Promise<void>
}

export function PlanForm({ plan, title, description, submitLabel, submitting, onSubmit }: Props) {
  const form = useForm<PlanFormValues>({
    resolver: zodResolver(planSchema),
    defaultValues: initialValues(plan),
  })
  const features = useFieldArray({ control: form.control, name: 'features' })
  const values = form.watch()
  const preview: MembershipPlan = {
    id: plan?.id ?? 'preview',
    gym_id: plan?.gym_id ?? 'preview',
    name: values.name || 'Your plan name',
    description: null,
    price: Number.isFinite(values.price) ? values.price : 0,
    duration_type: values.duration_type,
    duration_value: Number.isFinite(values.duration_value) ? values.duration_value : 1,
    features: values.features?.map(feature => feature.value).filter(Boolean) ?? [],
    max_freezes: values.allowFreezing ? (values.unlimitedFreezes ? null : values.max_freezes) : 0,
    max_freeze_days: values.allowFreezing ? (values.unlimitedFreezeDays ? null : values.max_freeze_days) : null,
    allow_future_start: values.allow_future_start,
    is_active: plan?.is_active ?? true,
    sort_order: values.sort_order,
    created_by: plan?.created_by ?? null,
    created_at: plan?.created_at ?? '',
    updated_at: plan?.updated_at ?? '',
  }

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-muted-foreground">{description}</p>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,420px)]">
        <Card>
          <CardHeader>
            <CardTitle>Plan details</CardTitle>
            <CardDescription>Set the pricing, duration, benefits, and freeze policy.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Plan name *</FormLabel>
                    <FormControl><Input placeholder="3-Month Premium" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField control={form.control} name="price" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price before GST (₹) *</FormLabel>
                      <FormControl><Input type="number" min="0" step="0.01" inputMode="decimal" {...field} onChange={event => field.onChange(event.target.valueAsNumber)} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="sort_order" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sort order</FormLabel>
                      <FormControl><Input type="number" step="1" inputMode="numeric" {...field} onChange={event => field.onChange(event.target.valueAsNumber)} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField control={form.control} name="duration_type" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Duration type *</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="days">Days</SelectItem>
                          <SelectItem value="months">Months</SelectItem>
                          <SelectItem value="years">Years</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="duration_value" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Duration value *</FormLabel>
                      <FormControl><Input type="number" min="1" step="1" inputMode="numeric" {...field} onChange={event => field.onChange(event.target.valueAsNumber)} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <fieldset className="space-y-3">
                  <legend className="text-sm font-medium">Features</legend>
                  {features.fields.map((feature, index) => (
                    <FormField key={feature.id} control={form.control} name={`features.${index}.value`} render={({ field }) => (
                      <FormItem>
                        <div className="flex gap-2">
                          <FormControl><Input aria-label={`Feature ${index + 1}`} placeholder="Gym access" {...field} /></FormControl>
                          <Button type="button" variant="ghost" size="icon" aria-label={`Remove feature ${index + 1}`} disabled={features.fields.length === 1} onClick={() => features.remove(index)}>
                            <Trash2 aria-hidden="true" />
                          </Button>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )} />
                  ))}
                  <Button type="button" variant="outline" onClick={() => features.append({ value: '' })}><Plus aria-hidden="true" /> Add Feature</Button>
                </fieldset>

                <fieldset className="space-y-4 rounded-lg border p-4">
                  <legend className="px-1 text-sm font-medium">Freeze settings</legend>
                  <FormField control={form.control} name="allowFreezing" render={({ field }) => (
                    <FormItem className="flex min-h-11 items-center justify-between gap-4">
                      <FormLabel>Allow freezing</FormLabel>
                      <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                    </FormItem>
                  )} />
                  {values.allowFreezing && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="max-freezes">Maximum freezes</Label>
                        <Input id="max-freezes" type="number" min="1" disabled={values.unlimitedFreezes} value={values.max_freezes} onChange={event => form.setValue('max_freezes', event.target.valueAsNumber, { shouldValidate: true })} />
                        <label className="flex min-h-11 items-center gap-3 text-sm">
                          <Checkbox checked={values.unlimitedFreezes} onCheckedChange={checked => form.setValue('unlimitedFreezes', checked)} />
                          Unlimited freezes
                        </label>
                        {form.formState.errors.max_freezes && <p role="alert" className="text-sm text-destructive">{form.formState.errors.max_freezes.message}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="max-freeze-days">Maximum days per freeze</Label>
                        <Input id="max-freeze-days" type="number" min="1" disabled={values.unlimitedFreezeDays} value={values.max_freeze_days} onChange={event => form.setValue('max_freeze_days', event.target.valueAsNumber, { shouldValidate: true })} />
                        <label className="flex min-h-11 items-center gap-3 text-sm">
                          <Checkbox checked={values.unlimitedFreezeDays} onCheckedChange={checked => form.setValue('unlimitedFreezeDays', checked)} />
                          Unlimited days
                        </label>
                        {form.formState.errors.max_freeze_days && <p role="alert" className="text-sm text-destructive">{form.formState.errors.max_freeze_days.message}</p>}
                      </div>
                    </div>
                  )}
                </fieldset>

                <FormField control={form.control} name="allow_future_start" render={({ field }) => (
                  <FormItem className="flex min-h-11 items-center justify-between gap-4 rounded-lg border p-4">
                    <div>
                      <FormLabel>Allow future start date</FormLabel>
                      <p className="mt-1 text-sm text-muted-foreground">Staff can schedule this plan as a renewal.</p>
                    </div>
                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                  </FormItem>
                )} />

                <div className="flex flex-col-reverse gap-2 border-t pt-6 sm:flex-row sm:justify-end">
                  <Button nativeButton={false} type="button" variant="outline" render={<Link to="/admin/plans">Cancel</Link>} />
                  <Button type="submit" disabled={submitting}>{submitting ? 'Saving…' : submitLabel}</Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
        <div className="lg:sticky lg:top-20">
          <p className="mb-3 text-sm font-medium text-muted-foreground">Live preview</p>
          <PlanCard plan={preview} />
        </div>
      </div>
    </div>
  )
}
