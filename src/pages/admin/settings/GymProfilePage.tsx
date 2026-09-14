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
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

const formSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().optional().nullable(),
  email: z.string().email('Invalid email address').optional().nullable().or(z.literal('')),
  website: z.string().url('Invalid URL').optional().nullable().or(z.literal('')),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  pincode: z.string().optional().nullable(),
  logo_url: z.string().url('Invalid URL').optional().nullable().or(z.literal('')),
  brand_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color code'),
})

type FormValues = z.infer<typeof formSchema>

export default function GymProfilePage() {
  const { gym, refreshGyms, hasPermission } = useGym()
  const [isSaving, setIsSaving] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      phone: '',
      email: '',
      website: '',
      address: '',
      city: '',
      state: '',
      pincode: '',
      logo_url: '',
      brand_color: '#171717',
    },
  })

  useEffect(() => {
    async function loadGymProfile() {
      if (gym && supabase) {
        const { data, error } = await supabase
          .from('gyms')
          .select('id, name, slug, logo_url, brand_color, brand_color_secondary, address, city, state, pincode, phone, email, website, gstin, business_hours, working_days, timezone, invoice_prefix, invoice_year, invoice_counter, gst_inclusive, is_active, settings, created_at, updated_at')
          .eq('id', gym.gym_id)
          .single()
        if (error) {
          toast.error(error.message || 'Failed to load gym profile')
          return
        }
        if (data) {
          form.reset({
            name: data.name,
            phone: data.phone || '',
            email: data.email || '',
            website: data.website || '',
            address: data.address || '',
            city: data.city || '',
            state: data.state || '',
            pincode: data.pincode || '',
            logo_url: data.logo_url || '',
            brand_color: data.brand_color || '#171717',
          })
        }
      }
    }
    loadGymProfile()
  }, [gym, form])

  const canEdit = hasPermission('settings.manage')

  async function onSubmit(data: FormValues) {
    if (!gym || !supabase) return
    setIsSaving(true)
    
    try {
      const { error } = await supabase
        .from('gyms')
        .update({
          name: data.name,
          phone: data.phone || null,
          email: data.email || null,
          website: data.website || null,
          address: data.address || null,
          city: data.city || null,
          state: data.state || null,
          pincode: data.pincode || null,
          logo_url: data.logo_url || null,
          brand_color: data.brand_color || '#171717',
        })
        .eq('id', gym.gym_id)
        
      if (error) throw error
      
      toast.success('Gym profile updated successfully')
      await refreshGyms()
    } catch (error: any) {
      toast.error(error.message || 'Failed to update gym profile')
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
          <CardTitle>Gym Profile</CardTitle>
          <CardDescription>Update your gym's public information and branding.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              
              <div className="grid gap-6 md:grid-cols-2">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gym Name *</FormLabel>
                    <FormControl><Input {...field} disabled={!canEdit} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <div className="grid gap-2">
                  <Label htmlFor="gym-slug">Slug (Read-only)</Label>
                  <Input id="gym-slug" value={gym?.slug || ''} disabled readOnly />
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <FormField control={form.control} name="phone" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl><Input type="tel" {...field} value={field.value || ''} disabled={!canEdit} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl><Input type="email" {...field} value={field.value || ''} disabled={!canEdit} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="website" render={({ field }) => (
                <FormItem>
                  <FormLabel>Website</FormLabel>
                  <FormControl><Input type="url" placeholder="https://..." {...field} value={field.value || ''} disabled={!canEdit} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="address" render={({ field }) => (
                <FormItem>
                  <FormLabel>Address</FormLabel>
                  <FormControl><Textarea {...field} value={field.value || ''} disabled={!canEdit} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid gap-6 md:grid-cols-3">
                <FormField control={form.control} name="city" render={({ field }) => (
                  <FormItem>
                    <FormLabel>City</FormLabel>
                    <FormControl><Input {...field} value={field.value || ''} disabled={!canEdit} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="state" render={({ field }) => (
                  <FormItem>
                    <FormLabel>State</FormLabel>
                    <FormControl><Input {...field} value={field.value || ''} disabled={!canEdit} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="pincode" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pincode</FormLabel>
                    <FormControl><Input {...field} value={field.value || ''} disabled={!canEdit} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="pt-4 border-t">
                <h3 className="mb-4 text-lg font-medium">Branding</h3>
                <div className="grid gap-6 md:grid-cols-2">
                  <FormField control={form.control} name="brand_color" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Brand Color (Hex)</FormLabel>
                      <div className="flex gap-3">
                        <FormControl>
                          <Input type="color" className="w-16 p-1 h-11" {...field} disabled={!canEdit} />
                        </FormControl>
                        <FormControl>
                          <Input className="flex-1" {...field} disabled={!canEdit} />
                        </FormControl>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">This updates the primary color live in your dashboard.</p>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="logo_url" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Logo URL</FormLabel>
                      <FormControl><Input placeholder="https://..." {...field} value={field.value || ''} disabled={!canEdit} /></FormControl>
                      <p className="text-xs text-muted-foreground mt-1">Direct link to your gym's logo image.</p>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </div>

              {canEdit && (
                <div className="flex justify-end pt-4 border-t">
                  <Button type="submit" disabled={isSaving}>
                    {isSaving ? 'Saving...' : 'Save Profile'}
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
