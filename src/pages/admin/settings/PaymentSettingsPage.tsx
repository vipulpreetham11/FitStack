import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useGym } from '@/hooks/useGym'
import SettingsNav from '@/components/layout/SettingsNav'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const formSchema = z.object({
  razorpay_key_id: z.string().optional().nullable().or(z.literal('')),
  razorpay_key_secret: z.string().optional().nullable().or(z.literal('')),
  razorpay_webhook_secret: z.string().optional().nullable().or(z.literal('')),
})

type FormValues = z.infer<typeof formSchema>

export default function PaymentSettingsPage() {
  const { gym, refreshGyms, hasPermission } = useGym()
  const [isSaving, setIsSaving] = useState(false)

  // Only owner can manage payment credentials
  const canEdit = hasPermission('credentials.manage')

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      razorpay_key_id: '',
      razorpay_key_secret: '',
      razorpay_webhook_secret: '',
    },
  })

  async function onSubmit(data: FormValues) {
    if (!gym || !supabase || !canEdit) return
    setIsSaving(true)

    // TODO: Production will encrypt these credentials via Edge Function before storing
    // For now, storing as-is to satisfy UI flow
    try {
      const { error } = await supabase
        .from('gyms')
        .update({
          razorpay_key_id_enc: data.razorpay_key_id || null,
          razorpay_key_secret_enc: data.razorpay_key_secret || null,
          razorpay_webhook_secret_enc: data.razorpay_webhook_secret || null,
        })
        .eq('id', gym.gym_id)
        
      if (error) throw error
      
      toast.success('Payment credentials updated successfully')
      await refreshGyms()
    } catch (error: any) {
      toast.error(error.message || 'Failed to update payment settings')
    } finally {
      setIsSaving(false)
    }
  }



  if (!canEdit) {
    return (
      <div className="max-w-4xl space-y-6 pb-12">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
          <p className="text-muted-foreground mt-2">Manage your gym's configuration and preferences.</p>
        </div>
        <SettingsNav />
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            You do not have permission to view or manage payment credentials. Only the gym owner can access this page.
          </CardContent>
        </Card>
      </div>
    )
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
          <CardTitle>Payment Gateway</CardTitle>
          <CardDescription>Configure Razorpay to accept online payments from members. Saved credentials are never returned to the browser; enter new values only when replacing them.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-lg">
              
              <FormField control={form.control} name="razorpay_key_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Razorpay Key ID</FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      value={field.value || ''} 
                      placeholder="rzp_live_..."
                      autoComplete="off"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="razorpay_key_secret" render={({ field }) => (
                <FormItem>
                  <FormLabel>Razorpay Key Secret</FormLabel>
                  <FormControl>
                    <Input 
                      type="password"
                      {...field} 
                      value={field.value || ''} 
                      autoComplete="off"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="razorpay_webhook_secret" render={({ field }) => (
                <FormItem>
                  <FormLabel>Razorpay Webhook Secret</FormLabel>
                  <FormControl>
                    <Input 
                      type="password"
                      {...field} 
                      value={field.value || ''} 
                      autoComplete="off"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="pt-2">
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save Credentials'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex-col items-start bg-muted/50 p-6 rounded-b-lg border-t">
          <h3 className="font-medium mb-2">Setup Guide</h3>
          <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
            <li>Create a Razorpay account at razorpay.com</li>
            <li>Go to Settings → API Keys → Generate Key</li>
            <li>Copy Key ID and Key Secret here</li>
            <li>Go to Settings → Webhooks → Create webhook pointing to your webhook URL</li>
          </ol>
        </CardFooter>
      </Card>
    </div>
  )
}
