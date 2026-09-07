import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useGym } from '@/hooks/useGym'
import { formatDate } from '@/lib/format'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'

const schema = z.object({
  full_name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  date_of_birth: z.string().optional().or(z.literal('')),
  gender: z.string().optional().or(z.literal('')),
  emergency_contact_name: z.string().optional().or(z.literal('')),
  emergency_contact_phone: z.string().optional().or(z.literal('')),
})
type FormValues = z.infer<typeof schema>

export default function MemberProfilePage() {
  const { profile, signOut, refreshProfile } = useAuth()
  const { gymMember, gym } = useGym()
  const [saving, setSaving] = useState(false)

  const form = useForm<FormValues>({ resolver: zodResolver(schema) })

  useEffect(() => {
    if (!profile) return
    form.reset({
      full_name: profile.full_name ?? '',
      email: profile.email ?? '',
      date_of_birth: (profile as any).date_of_birth ?? '',
      gender: (profile as any).gender ?? '',
      emergency_contact_name: (profile as any).emergency_contact_name ?? '',
      emergency_contact_phone: (profile as any).emergency_contact_phone ?? '',
    })
  }, [profile, form])

  const onSave = async (values: FormValues) => {
    if (!profile || !supabase) return
    setSaving(true)
    try {
      const { error } = await supabase.from('profiles').update({
        full_name: values.full_name,
        email: values.email || null,
        date_of_birth: (values as any).date_of_birth || null,
        gender: (values as any).gender || null,
        emergency_contact_name: (values as any).emergency_contact_name || null,
        emergency_contact_phone: (values as any).emergency_contact_phone || null,
      } as any).eq('id', profile.id)
      if (error) throw error
      refreshProfile()
      toast.success('Profile updated')
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to save')
    } finally { setSaving(false) }
  }

  const initials = profile?.full_name?.slice(0, 2).toUpperCase() ?? 'ME'

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-10">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Your profile</h1>
        <p className="mt-1 text-muted-foreground">Manage your personal information</p>
      </div>

      {/* Avatar + info */}
      <Card>
        <CardContent className="pt-6 flex items-center gap-5">
          {!profile ? <Skeleton className="h-16 w-16 rounded-full" /> : (
            <div className="h-16 w-16 rounded-full flex items-center justify-center text-white text-xl font-semibold shrink-0" style={{ background: gym?.brand_color ?? '#171717' }}>
              {initials}
            </div>
          )}
          <div>
            {!profile ? <Skeleton className="h-5 w-32 mb-1" /> : <p className="font-semibold text-lg">{profile.full_name}</p>}
            <p className="text-sm text-muted-foreground">{profile?.phone ?? '—'} <span className="text-xs ml-1 text-muted-foreground">(login, can't change)</span></p>
            {gymMember?.member_code && <p className="text-sm text-muted-foreground mt-0.5">Code: {gymMember.member_code}</p>}
            {gymMember?.joined_at && <p className="text-sm text-muted-foreground mt-0.5">Joined: {formatDate(gymMember.joined_at)}</p>}
          </div>
        </CardContent>
      </Card>

      {/* Edit form */}
      <Card>
        <CardHeader><CardTitle>Personal Details</CardTitle></CardHeader>
        <CardContent>
          {!profile ? <Skeleton className="h-64" /> : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSave)} className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField control={form.control} name="full_name" render={({ field }) => (
                    <FormItem><FormLabel>Full Name *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField control={form.control} name="date_of_birth" render={({ field }) => (
                    <FormItem><FormLabel>Date of Birth</FormLabel><FormControl><Input type="date" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="gender" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Gender</FormLabel>
                      <Select onValueChange={v => field.onChange(v)} value={field.value ?? ''}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="female">Female</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                          <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <div className="border-t pt-4">
                  <p className="text-sm font-medium mb-3">Emergency Contact</p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField control={form.control} name="emergency_contact_name" render={({ field }) => (
                      <FormItem><FormLabel>Contact Name</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="emergency_contact_phone" render={({ field }) => (
                      <FormItem><FormLabel>Contact Phone</FormLabel><FormControl><Input type="tel" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                </div>
                <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</Button>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>

      {/* Sign out */}
      <div className="pt-4">
        <Button variant="destructive" className="w-full" onClick={() => void signOut()}>Sign Out</Button>
      </div>
    </div>
  )
}