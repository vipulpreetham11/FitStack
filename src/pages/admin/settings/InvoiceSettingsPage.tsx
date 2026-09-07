import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useGym } from '@/hooks/useGym'
import SettingsNav from '@/components/layout/SettingsNav'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'

const formSchema = z.object({
  invoice_prefix: z.string().min(1, 'Prefix is required').max(10, 'Prefix too long').toUpperCase(),
  gstin: z.string().optional().nullable().or(z.literal('')),
})

type FormValues = z.infer<typeof formSchema>

export default function InvoiceSettingsPage() {
  const { gym, refreshGyms, hasPermission } = useGym()
  const [isSaving, setIsSaving] = useState(false)
  const [counters, setCounters] = useState({ year: new Date().getFullYear(), counter: 1 })

  const canEdit = hasPermission('settings.manage')

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      invoice_prefix: 'INV',
      gstin: '',
    },
  })

  useEffect(() => {
    async function loadGymSettings() {
      if (gym && supabase) {
        const { data } = await supabase.from('gyms').select('invoice_prefix, gstin, invoice_year, invoice_counter').eq('id', gym.gym_id).single()
        if (data) {
          form.reset({
            invoice_prefix: data.invoice_prefix || gym.name.substring(0, 3).toUpperCase(),
            gstin: data.gstin || '',
          })
          setCounters({ year: data.invoice_year, counter: data.invoice_counter })
        }
      }
    }
    loadGymSettings()
  }, [gym, form])

  async function onSubmit(data: FormValues) {
    if (!gym || !supabase) return
    setIsSaving(true)

    try {
      const { error } = await supabase
        .from('gyms')
        .update({
          invoice_prefix: data.invoice_prefix,
          gstin: data.gstin || null,
        })
        .eq('id', gym.gym_id)
        
      if (error) throw error
      
      toast.success('Invoice settings updated successfully')
      await refreshGyms()
    } catch (error: any) {
      toast.error(error.message || 'Failed to update invoice settings')
    } finally {
      setIsSaving(false)
    }
  }

  // Format invoice number preview
  const year = counters.year
  const nextCounter = String(counters.counter).padStart(4, '0')
  const prefix = form.watch('invoice_prefix') || 'INV'
  const nextInvoicePreview = `${prefix}-${year}-${nextCounter}`

  return (
    <div className="max-w-4xl space-y-6 pb-12">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-2">Manage your gym's configuration and preferences.</p>
      </div>

      <SettingsNav />

      <Card>
        <CardHeader>
          <CardTitle>Invoicing & Taxation</CardTitle>
          <CardDescription>Configure how invoices are generated for member payments.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-lg">
              
              <div className="bg-muted/50 p-4 rounded-md mb-6">
                <p className="text-sm font-medium">Next invoice will be:</p>
                <p className="text-2xl font-mono mt-1">{nextInvoicePreview}</p>
              </div>

              <FormField control={form.control} name="invoice_prefix" render={({ field }) => (
                <FormItem>
                  <FormLabel>Invoice Prefix</FormLabel>
                  <FormControl>
                    <Input {...field} disabled={!canEdit} onChange={e => field.onChange(e.target.value.toUpperCase())} />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">Used as the starting sequence for your invoice numbers.</p>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="gstin" render={({ field }) => (
                <FormItem>
                  <FormLabel>GSTIN (Optional)</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value || ''} placeholder="22AAAAA0000A1Z5" disabled={!canEdit} onChange={e => field.onChange(e.target.value.toUpperCase())} />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">Will be printed on all generated invoices if provided.</p>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="flex flex-row items-center justify-between rounded-lg border p-4 opacity-70">
                <div className="space-y-0.5">
                  <Label className="text-base text-foreground">GST Inclusive Pricing</Label>
                  <div className="text-sm text-muted-foreground max-w-[250px]">
                    GST is always exclusive (price + GST) per current business configuration.
                  </div>
                </div>
                <Switch checked={false} disabled={true} />
              </div>

              {canEdit && (
                <div className="pt-2">
                  <Button type="submit" disabled={isSaving}>
                    {isSaving ? 'Saving...' : 'Save Settings'}
                  </Button>
                </div>
              )}
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
