import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { CheckCircle2, ChevronRight, ChevronLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import SuperAdminHeader from '@/components/super-admin/SuperAdminHeader'

const DAYS = [
  { id: 1, label: 'Mon' }, { id: 2, label: 'Tue' }, { id: 3, label: 'Wed' },
  { id: 4, label: 'Thu' }, { id: 5, label: 'Fri' }, { id: 6, label: 'Sat' }, { id: 0, label: 'Sun' },
]

const formSchema = z.object({
  // Identity
  name: z.string().min(2, 'Name is required'),
  slug: z.string().min(2, 'Slug is required').regex(/^[a-z0-9-]+$/, 'Only lowercase letters, numbers, and hyphens'),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  pincode: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email('Invalid email').optional().nullable().or(z.literal('')),
  
  // Branding
  brand_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Valid hex required'),
  brand_color_secondary: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Valid hex required').optional().nullable().or(z.literal('')),
  logo_url: z.string().url('Invalid URL').optional().nullable().or(z.literal('')),
  
  // Business
  gstin: z.string().optional().nullable().or(z.literal('')),
  open: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Valid time required'),
  close: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Valid time required'),
  working_days: z.array(z.number()).min(1, 'Select at least one day'),
  
  // Payments
  razorpay_key_id: z.string().optional().nullable().or(z.literal('')),
  razorpay_key_secret: z.string().optional().nullable().or(z.literal('')),
  razorpay_webhook_secret: z.string().optional().nullable().or(z.literal('')),
  invoice_prefix: z.string().min(1, 'Required').max(10),
  
  // Owner
  owner_name: z.string().min(2, 'Owner name required'),
  owner_phone: z.string().min(10, 'Valid phone required'),
})

type FormValues = z.infer<typeof formSchema>

const STEPS = [
  { id: 1, name: 'Identity' },
  { id: 2, name: 'Branding' },
  { id: 3, name: 'Business' },
  { id: 4, name: 'Payments' },
  { id: 5, name: 'Owner' },
  { id: 6, name: 'Review' },
]

export default function CreateGymPage() {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '', slug: '', city: '', state: '', address: '', pincode: '', phone: '', email: '',
      brand_color: '#171717', brand_color_secondary: '', logo_url: '',
      gstin: '', open: '06:00', close: '22:00', working_days: [1, 2, 3, 4, 5, 6],
      razorpay_key_id: '', razorpay_key_secret: '', razorpay_webhook_secret: '', invoice_prefix: '',
      owner_name: '', owner_phone: '',
    },
  })


  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    form.setValue('name', val, { shouldValidate: true })
    
    if (!form.formState.dirtyFields.slug) {
      form.setValue('slug', val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''))
    }
    if (!form.formState.dirtyFields.invoice_prefix) {
      form.setValue('invoice_prefix', val.substring(0, 3).toUpperCase())
    }
  }

  const nextStep = async () => {
    let fieldsToValidate: (keyof FormValues)[] = []
    if (currentStep === 1) fieldsToValidate = ['name', 'slug', 'city', 'state', 'address', 'pincode', 'phone', 'email']
    if (currentStep === 2) fieldsToValidate = ['brand_color', 'brand_color_secondary', 'logo_url']
    if (currentStep === 3) fieldsToValidate = ['gstin', 'open', 'close', 'working_days']
    if (currentStep === 4) fieldsToValidate = ['razorpay_key_id', 'razorpay_key_secret', 'razorpay_webhook_secret', 'invoice_prefix']
    if (currentStep === 5) fieldsToValidate = ['owner_name', 'owner_phone']

    const isValid = await form.trigger(fieldsToValidate)
    if (isValid) setCurrentStep(s => Math.min(s + 1, STEPS.length))
  }

  const prevStep = () => setCurrentStep(s => Math.max(s - 1, 1))

  const onSubmit = async (data: FormValues) => {
    if (!supabase) return
    setIsSubmitting(true)

    try {
      const { data: result, error } = await supabase.functions.invoke('create-gym', { body: {
        name: data.name,
        slug: data.slug,
        city: data.city || null,
        state: data.state || null,
        address: data.address || null,
        pincode: data.pincode || null,
        phone: data.phone || null,
        email: data.email || null,
        brand_color: data.brand_color,
        brand_color_secondary: data.brand_color_secondary || null,
        logo_url: data.logo_url || null,
        gstin: data.gstin || null,
        business_hours: { open: data.open, close: data.close },
        working_days: data.working_days,
        invoice_prefix: data.invoice_prefix,
        razorpay_key_id: data.razorpay_key_id || null,
        razorpay_key_secret: data.razorpay_key_secret || null,
        razorpay_webhook_secret: data.razorpay_webhook_secret || null,
        owner_name: data.owner_name,
        owner_phone: data.owner_phone,
      } })
      if (error) throw error
      if (result?.error) throw new Error(String(result.error))

      toast.success('Gym created successfully!')
      navigate('/super-admin')
    } catch (error: any) {
      toast.error(error.message || 'Failed to create gym')
    } finally {
      setIsSubmitting(false)
    }
  }

  const values = form.getValues()

  return (
    <div className="min-h-dvh bg-muted/20">
      <SuperAdminHeader />
      <main className="max-w-4xl space-y-8 p-5 pb-12 sm:p-8 mx-auto">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Onboard New Gym</h1>
        <p className="text-muted-foreground mt-2">Provision a new gym tenant and set up the primary owner.</p>
      </div>

      <div className="flex items-center justify-between mb-8 overflow-x-auto pb-4">
        {STEPS.map((step, idx) => (
          <div key={step.id} className="flex items-center min-w-max">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${
              currentStep > step.id ? 'bg-primary border-primary text-primary-foreground' :
              currentStep === step.id ? 'border-primary text-primary' :
              'border-muted text-muted-foreground'
            }`}>
              {currentStep > step.id ? <CheckCircle2 className="w-5 h-5" /> : step.id}
            </div>
            <span className={`ml-2 text-sm font-medium ${
              currentStep >= step.id ? 'text-foreground' : 'text-muted-foreground'
            }`}>
              {step.name}
            </span>
            {idx < STEPS.length - 1 && (
              <div className="mx-4 h-[2px] w-8 lg:w-16 bg-muted" />
            )}
          </div>
        ))}
      </div>

      <Card>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="pt-6">
              
              {/* STEP 1: IDENTITY */}
              <div className={currentStep === 1 ? 'block space-y-6' : 'hidden'}>
                <div className="grid gap-6 md:grid-cols-2">
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Gym Name *</FormLabel>
                      <FormControl><Input {...field} onChange={handleNameChange} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="slug" render={({ field }) => (
                    <FormItem>
                      <FormLabel>URL Slug *</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <div className="grid gap-6 md:grid-cols-2">
                  <FormField control={form.control} name="phone" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Public Phone</FormLabel>
                      <FormControl><Input {...field} value={field.value || ''} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Public Email</FormLabel>
                      <FormControl><Input {...field} value={field.value || ''} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="address" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl><Input {...field} value={field.value || ''} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid gap-6 md:grid-cols-3">
                  <FormField control={form.control} name="city" render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl><Input {...field} value={field.value || ''} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="state" render={({ field }) => (
                    <FormItem>
                      <FormLabel>State</FormLabel>
                      <FormControl><Input {...field} value={field.value || ''} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="pincode" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pincode</FormLabel>
                      <FormControl><Input {...field} value={field.value || ''} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </div>

              {/* STEP 2: BRANDING */}
              <div className={currentStep === 2 ? 'block space-y-6' : 'hidden'}>
                <div className="grid gap-6 md:grid-cols-2">
                  <FormField control={form.control} name="brand_color" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Primary Brand Color *</FormLabel>
                      <div className="flex gap-3">
                        <FormControl><Input type="color" className="w-16 p-1 h-11" {...field} /></FormControl>
                        <FormControl><Input className="flex-1" {...field} /></FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="brand_color_secondary" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Secondary Brand Color</FormLabel>
                      <div className="flex gap-3">
                        <FormControl><Input type="color" className="w-16 p-1 h-11" {...field} value={field.value || '#ffffff'} /></FormControl>
                        <FormControl><Input className="flex-1" {...field} value={field.value || ''} /></FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="logo_url" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Logo URL</FormLabel>
                    <FormControl><Input placeholder="https://..." {...field} value={field.value || ''} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              {/* STEP 3: BUSINESS */}
              <div className={currentStep === 3 ? 'block space-y-6' : 'hidden'}>
                <FormField control={form.control} name="gstin" render={({ field }) => (
                  <FormItem className="max-w-md">
                    <FormLabel>GSTIN</FormLabel>
                    <FormControl><Input {...field} value={field.value || ''} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid gap-6 sm:grid-cols-2 max-w-md">
                  <FormField control={form.control} name="open" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Opening Time *</FormLabel>
                      <FormControl><Input type="time" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="close" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Closing Time *</FormLabel>
                      <FormControl><Input type="time" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="working_days" render={() => (
                  <FormItem>
                    <FormLabel>Working Days *</FormLabel>
                    <div className="flex flex-wrap gap-4 mt-2">
                      {DAYS.map((day) => (
                        <FormField key={day.id} control={form.control} name="working_days" render={({ field }) => (
                          <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value?.includes(day.id)}
                                onCheckedChange={(checked) => {
                                  return checked
                                    ? field.onChange([...field.value, day.id])
                                    : field.onChange(field.value?.filter((v) => v !== day.id))
                                }}
                              />
                            </FormControl>
                            <FormLabel className="font-normal cursor-pointer">{day.label}</FormLabel>
                          </FormItem>
                        )} />
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              {/* STEP 4: PAYMENTS */}
              <div className={currentStep === 4 ? 'block space-y-6' : 'hidden'}>
                <FormField control={form.control} name="invoice_prefix" render={({ field }) => (
                  <FormItem className="max-w-xs">
                    <FormLabel>Invoice Prefix *</FormLabel>
                    <FormControl><Input {...field} onChange={e => field.onChange(e.target.value.toUpperCase())} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="space-y-4 max-w-lg border-t pt-4">
                  <h3 className="font-medium">Razorpay Credentials (Optional)</h3>
                  <FormField control={form.control} name="razorpay_key_id" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Key ID</FormLabel>
                      <FormControl><Input {...field} value={field.value || ''} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="razorpay_key_secret" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Key Secret</FormLabel>
                      <FormControl><Input type="password" {...field} value={field.value || ''} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="razorpay_webhook_secret" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Webhook Secret</FormLabel>
                      <FormControl><Input type="password" {...field} value={field.value || ''} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </div>

              {/* STEP 5: OWNER */}
              <div className={currentStep === 5 ? 'block space-y-6' : 'hidden'}>
                <div className="bg-muted/50 p-4 rounded-md mb-4 text-sm text-muted-foreground">
                  This will create a new user profile and link them as the Gym Owner.
                  If the phone number already exists in FitStack, they will be granted access to this new gym.
                </div>
                <div className="grid gap-6 md:grid-cols-2">
                  <FormField control={form.control} name="owner_name" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Owner Name *</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="owner_phone" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Owner Phone (10 digits) *</FormLabel>
                      <FormControl><Input type="tel" placeholder="9876543210" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </div>

              {/* STEP 6: REVIEW */}
              <div className={currentStep === 6 ? 'block space-y-6' : 'hidden'}>
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-1">Gym Identity</h4>
                      <p className="font-medium">{values.name} <span className="text-muted-foreground font-normal">({values.slug})</span></p>
                      <p className="text-sm">{values.city ? `${values.city}, ${values.state}` : 'No location specified'}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-1">Owner</h4>
                      <p className="font-medium">{values.owner_name}</p>
                      <p className="text-sm">{values.owner_phone}</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-1">Branding</h4>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full border" style={{ backgroundColor: values.brand_color }} />
                        <span className="text-sm uppercase">{values.brand_color}</span>
                      </div>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-1">Business</h4>
                      <p className="text-sm">Hours: {values.open} - {values.close}</p>
                      <p className="text-sm">Days: {values.working_days?.length} selected</p>
                    </div>
                  </div>
                </div>
              </div>

            </CardContent>
            <CardFooter className="flex justify-between border-t pt-6">
              <Button
                type="button"
                variant="outline"
                onClick={prevStep}
                disabled={currentStep === 1 || isSubmitting}
              >
                <ChevronLeft className="w-4 h-4 mr-2" /> Back
              </Button>
              
              {currentStep < STEPS.length ? (
                <Button type="button" onClick={nextStep}>
                  Next <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Creating Gym...' : 'Create Gym'}
                </Button>
              )}
            </CardFooter>
          </form>
        </Form>
      </Card>
      </main>
    </div>
  )
}
