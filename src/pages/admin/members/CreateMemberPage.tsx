import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { ChevronLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useGym } from '@/hooks/useGym'
import { normalizePhone } from '@/lib/format'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const formSchema = z.object({
  phone: z.string().min(10, 'Valid 10-digit phone number is required'),
  full_name: z.string().min(2, 'Name is required'),
  email: z.string().email('Invalid email').optional().nullable().or(z.literal('')),
  date_of_birth: z.string().optional().nullable().or(z.literal('')),
  gender: z.string().optional().nullable().or(z.literal('')),
  role: z.enum(['member', 'trainer', 'receptionist', 'admin']),
  member_code: z.string().optional().nullable().or(z.literal('')),
})

type FormValues = z.infer<typeof formSchema>

export default function CreateMemberPage() {
  const navigate = useNavigate()
  const { gym, hasPermission } = useGym()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isStaff = hasPermission('settings.manage') // only owner/admin can create other admins

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      phone: '',
      full_name: '',
      email: '',
      date_of_birth: '',
      gender: '',
      role: 'member',
      member_code: '',
    },
  })

  // Auto-generate member code suggestion
  useEffect(() => {
    if (!gym) return
    const prefix = gym.name.substring(0, 3).toUpperCase()
    const randomNum = Math.floor(1000 + Math.random() * 9000)
    form.setValue('member_code', `${prefix}-${randomNum}`)
  }, [gym, form])

  const onSubmit = async (data: FormValues) => {
    if (!gym || !supabase) return
    setIsSubmitting(true)

    try {
      const normalizedPhone = normalizePhone(data.phone)
      
      // 1. Check if profile exists
      let profileId: string | null = null
      
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('phone', normalizedPhone)
        .maybeSingle()

      if (existingProfile) {
        profileId = existingProfile.id
        
        // Check if they are already in THIS gym
        const { data: existingMember } = await supabase
          .from('gym_members')
          .select('id')
          .eq('gym_id', gym.gym_id)
          .eq('profile_id', profileId)
          .maybeSingle()
          
        if (existingMember) {
          throw new Error('This person is already a member of this gym.')
        }
      } else {
        // 2. Create new user profile
        // TODO: Production needs Edge Function for `supabase.auth.admin.createUser()`
        // Development workaround: just insert into profiles (if RLS allows) or use signUp
        const { data: authData, error: authError } = await supabase.auth.signUp({
          phone: normalizedPhone,
          password: 'MemberPassword123!',
        })
        
        if (authError && !authError.message.includes('already registered')) {
          throw new Error(`Failed to create user auth: ${authError.message}`)
        }
        
        if (authData?.user) {
          profileId = authData.user.id
          
          // Update profile with details
          await supabase.from('profiles').update({
            full_name: data.full_name,
            phone: normalizedPhone,
            email: data.email || null,
            date_of_birth: data.date_of_birth || null,
            gender: data.gender || null,
          }).eq('id', profileId)
        } else {
          // If RLS prevents this, we might need a direct DB function.
          throw new Error('Could not create new member profile automatically. Edge function required.')
        }
      }

      // 3. Create gym_member record
      const { data: newMember, error: memberError } = await supabase
        .from('gym_members')
        .insert({
          gym_id: gym.gym_id,
          profile_id: profileId,
          role: data.role,
          member_code: data.member_code || null,
          is_active: true,
          qr_secret: Array.from({length: 32}, () => Math.floor(Math.random()*36).toString(36)).join(''),
        })
        .select('id')
        .single()

      if (memberError) throw new Error(`Failed to add member to gym: ${memberError.message}`)

      toast.success(`${data.full_name} has been added successfully!`)
      navigate(`/admin/members/${newMember.id}`)
      
    } catch (error: any) {
      toast.error(error.message || 'Failed to create member')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <Link to="/admin/members" className="hover:text-foreground transition-colors flex items-center">
          <ChevronLeft className="w-4 h-4 mr-1" /> Back to Members
        </Link>
      </div>

      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Add New Member</h1>
        <p className="text-muted-foreground mt-2">Register a new member or staff to {gym?.name}.</p>
      </div>

      <Card>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="pt-6 space-y-6">
              
              <div className="grid gap-6 md:grid-cols-2">
                <FormField control={form.control} name="phone" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number (10 digits) *</FormLabel>
                    <FormControl><Input type="tel" placeholder="9876543210" {...field} /></FormControl>
                    <p className="text-xs text-muted-foreground">Used for login and WhatsApp notifications.</p>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="full_name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name *</FormLabel>
                    <FormControl><Input placeholder="John Doe" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl><Input type="email" placeholder="john@example.com" {...field} value={field.value || ''} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="member_code" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Member ID / Code</FormLabel>
                    <FormControl><Input {...field} value={field.value || ''} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <FormField control={form.control} name="date_of_birth" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date of Birth</FormLabel>
                    <FormControl><Input type="date" {...field} value={field.value || ''} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="gender" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gender</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || undefined}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                      </FormControl>
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

              <div className="pt-4 border-t">
                <FormField control={form.control} name="role" render={({ field }) => (
                  <FormItem className="max-w-xs">
                    <FormLabel>System Role *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="member">Gym Member</SelectItem>
                        <SelectItem value="trainer">Trainer</SelectItem>
                        {isStaff && <SelectItem value="receptionist">Receptionist</SelectItem>}
                        {isStaff && <SelectItem value="admin">Administrator</SelectItem>}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              
            </CardContent>
            <CardFooter className="flex justify-between border-t pt-6">
              <Button nativeButton={false} type="button" variant="outline" render={<Link to="/admin/members">Cancel</Link>} />
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Creating...' : 'Create Member'}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  )
}
