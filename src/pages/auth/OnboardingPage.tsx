import { Navigate,useLocation } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import { useGym } from '@/hooks/useGym'
import { authError,dashboardPath,onboardingSchema,safeReturnPath,type OnboardingValues } from '@/lib/auth'
import AuthCard from '@/components/auth/AuthCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
export default function OnboardingPage(){
 const auth=useAuth();const {role,isSuperAdmin}=useGym();const location=useLocation()
 const next=safeReturnPath(new URLSearchParams(location.search).get('next'))
 const {register,handleSubmit,formState:{errors,isSubmitting},setError}=useForm<OnboardingValues>({
  resolver:zodResolver(onboardingSchema),defaultValues:{full_name:auth.profile?.full_name==='New User'?'':auth.profile?.full_name??'',email:auth.profile?.email??auth.user?.email??'',date_of_birth:'',gender:'',emergency_contact_name:'',emergency_contact_phone:''},
 })
 if(auth.isOnboarded)return <Navigate to={next??dashboardPath(role,isSuperAdmin)} replace/>
 const fields=[['full_name','Full name *','text','name'],['email','Contact email (optional)','email','email'],['date_of_birth','Date of birth (optional)','date','bday'],['emergency_contact_name','Emergency contact name (optional)','text','off'],['emergency_contact_phone','Emergency contact phone (optional)','tel','off']] as const
 return <AuthCard title="Complete your profile" description="One last step. Tell us a little about yourself.">
  <p className="mb-5 text-xs uppercase tracking-widest text-muted-foreground">Profile setup · Step 1 of 1</p>
  <form noValidate onSubmit={handleSubmit(async values=>{try{await auth.saveProfile(values);toast.success('Profile saved.')}catch(e){const message=authError(e);setError('root',{message});toast.error(message)}})} className="space-y-4">
   {fields.map(([key,label,type,complete])=><div className="space-y-2" key={key}><Label htmlFor={key}>{label}</Label><Input id={key} type={type} autoComplete={complete} disabled={isSubmitting} max={type==='date'?format(new Date(),'yyyy-MM-dd'):undefined} min={type==='date'?'1900-01-01':undefined} aria-invalid={!!errors[key]} aria-describedby={errors[key]?key+'-error':undefined} {...register(key)}/>{errors[key]&&<p id={key+'-error'} role="alert" className="text-sm text-destructive">{errors[key]?.message}</p>}</div>)}
   <div className="space-y-2"><Label htmlFor="gender">Gender (optional)</Label><select id="gender" className="h-11 w-full rounded-md border bg-background px-3" disabled={isSubmitting} {...register('gender')}><option value="">Prefer not to say</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></div>
   <p className="text-xs text-muted-foreground">Contact email does not change your verified login identity.</p>
   {errors.root&&<p role="alert" className="text-sm text-destructive">{errors.root.message}</p>}
   <Button type="submit" className="w-full" disabled={isSubmitting}>{isSubmitting?'Saving…':'Save and continue'}</Button>
   <Button type="button" variant="ghost" className="w-full" disabled={isSubmitting} onClick={()=>void auth.signOut().catch(e=>toast.error(authError(e)))}>Sign out</Button>
  </form>
 </AuthCard>
}
