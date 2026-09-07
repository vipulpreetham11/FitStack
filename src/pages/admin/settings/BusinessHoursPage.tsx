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
import { Checkbox } from '@/components/ui/checkbox'

const DAYS = [
  { id: 1, label: 'Monday' },
  { id: 2, label: 'Tuesday' },
  { id: 3, label: 'Wednesday' },
  { id: 4, label: 'Thursday' },
  { id: 5, label: 'Friday' },
  { id: 6, label: 'Saturday' },
  { id: 0, label: 'Sunday' },
]

const formSchema = z.object({
  open: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Valid time required (HH:MM)'),
  close: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Valid time required (HH:MM)'),
  working_days: z.array(z.number()).min(1, 'Select at least one working day'),
})

type FormValues = z.infer<typeof formSchema>

export default function BusinessHoursPage() {
  const { gym, refreshGyms, hasPermission } = useGym()
  const [isSaving, setIsSaving] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      open: '06:00',
      close: '22:00',
      working_days: [1, 2, 3, 4, 5, 6],
    },
  })

  useEffect(() => {
    async function loadBusinessHours() {
      if (gym && supabase) {
        const { data } = await supabase.from('gyms').select('business_hours, working_days').eq('id', gym.gym_id).single()
        if (data) {
          const bh = data.business_hours as { open?: string; close?: string } | null
          const wd = data.working_days as number[] | null
          form.reset({
            open: bh?.open || '06:00',
            close: bh?.close || '22:00',
            working_days: Array.isArray(wd) ? wd : [1, 2, 3, 4, 5, 6],
          })
        }
      }
    }
    loadBusinessHours()
  }, [gym, form])

  const canEdit = hasPermission('settings.manage')

  async function onSubmit(data: FormValues) {
    if (!gym || !supabase) return
    setIsSaving(true)

    try {
      const { error } = await supabase
        .from('gyms')
        .update({
          business_hours: { open: data.open, close: data.close },
          working_days: data.working_days,
        })
        .eq('id', gym.gym_id)
        
      if (error) throw error
      
      toast.success('Business hours updated successfully')
      await refreshGyms()
    } catch (error: any) {
      toast.error(error.message || 'Failed to update business hours')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="max-w-4xl space-y-6 pb-12">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-2">Manage your gym's configuration and preferences.</p>
      </div>

      <SettingsNav />

      <Card>
        <CardHeader>
          <CardTitle>Business Hours</CardTitle>
          <CardDescription>Configure when your gym is open for members.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              
              <div className="grid gap-6 sm:grid-cols-2 max-w-md">
                <FormField control={form.control} name="open" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Opening Time</FormLabel>
                    <FormControl><Input type="time" {...field} disabled={!canEdit} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="close" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Closing Time</FormLabel>
                    <FormControl><Input type="time" {...field} disabled={!canEdit} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="working_days" render={() => (
                <FormItem>
                  <div className="mb-4">
                    <FormLabel className="text-base">Working Days</FormLabel>
                  </div>
                  <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {DAYS.map((day) => (
                      <FormField
                        key={day.id}
                        control={form.control}
                        name="working_days"
                        render={({ field }) => {
                          return (
                            <FormItem key={day.id} className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                              <FormControl>
                                <Checkbox
                                  disabled={!canEdit}
                                  checked={field.value?.includes(day.id)}
                                  onCheckedChange={(checked) => {
                                    return checked
                                      ? field.onChange([...field.value, day.id])
                                      : field.onChange(field.value?.filter((value) => value !== day.id))
                                  }}
                                />
                              </FormControl>
                              <FormLabel className="font-normal cursor-pointer text-sm w-full">
                                {day.label}
                              </FormLabel>
                            </FormItem>
                          )
                        }}
                      />
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )} />

              {canEdit && (
                <div className="flex justify-end pt-4 border-t">
                  <Button type="submit" disabled={isSaving}>
                    {isSaving ? 'Saving...' : 'Save Hours'}
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
