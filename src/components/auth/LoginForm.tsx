import { useEffect,useRef,useState } from 'react'
import { Controller,useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { ArrowRight,LoaderCircle } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { AUTH_MODE,authError,normalizeIdentity } from '@/lib/auth'
import { isSupabaseConfigured } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import PhoneInput from './PhoneInput'
import OTPInput from './OTPInput'
const schema=z.object({identity:z.string().refine(v=>{try{normalizeIdentity(v,AUTH_MODE);return true}catch{return false}},AUTH_MODE==='email'?'Enter a valid email address.':'Enter 10 digits starting with 6–9.')})
export default function LoginForm(){
 const {signIn,verifyOtp}=useAuth()
 const {register,control,handleSubmit,formState:{errors}}=useForm<{identity:string}>({resolver:zodResolver(schema),defaultValues:{identity:''}})
 const [identity,setIdentity]=useState<string|null>(null)
 const [otp,setOtp]=useState('')
 const [busy,setBusy]=useState(false)
 const busyRef=useRef(false)
 const [error,setError]=useState<string|null>(null)
 const [deadline,setDeadline]=useState(0)
 const [remaining,setRemaining]=useState(0)
 useEffect(()=>{
  const tick=()=>setRemaining(Math.max(0,Math.ceil((deadline-Date.now())/1000)))
  tick();const timer=window.setInterval(tick,250);return()=>clearInterval(timer)
 },[deadline])
 const run=async(action:()=>Promise<void>)=>{
  if(busyRef.current)return
  busyRef.current=true;setBusy(true);setError(null)
  try{await action()}catch(e){const message=authError(e);setError(message);toast.error(message);if((e as {status?:number})?.status===429)setDeadline(Date.now()+60000)}
  finally{busyRef.current=false;setBusy(false)}
 }
 const send=(value:string)=>run(async()=>{
  const normalized=normalizeIdentity(value,AUTH_MODE)
  await signIn(normalized);setIdentity(normalized);setOtp('');setDeadline(Date.now()+30000)
  toast.success(AUTH_MODE==='email'?'Code sent. Check your email.':'Code sent. Check your messages.')
 })
 const verify=(value:string)=>run(async()=>{if(identity){await verifyOtp(identity,value);toast.success('Signed in successfully.')}})
 return <div>
 {!isSupabaseConfigured&&<p className="mb-4 text-sm text-muted-foreground" role="status">Add your Supabase URL and public key to .env.local to enable login.</p>}
 {identity===null?<form onSubmit={handleSubmit(({identity:value})=>void send(value))} noValidate className="space-y-5">
  {AUTH_MODE==='email'?<div className="space-y-2"><Label htmlFor="email">Email address</Label><Input id="email" type="email" autoComplete="email" placeholder="you@example.com" disabled={busy} aria-invalid={!!errors.identity} aria-describedby={errors.identity?'email-error':undefined} {...register('identity')}/>{errors.identity&&<p id="email-error" role="alert" className="text-sm text-destructive">{errors.identity.message}</p>}</div>:<Controller name="identity" control={control} render={({field})=><PhoneInput {...field} disabled={busy} error={errors.identity?.message}/>}/>}
  <Button type="submit" className="w-full" disabled={busy||!isSupabaseConfigured}>{busy?<LoaderCircle className="animate-spin" aria-hidden="true"/>:<ArrowRight aria-hidden="true"/>}{busy?'Sending code…':'Send code'}</Button>
 </form>:<form onSubmit={e=>{e.preventDefault();void verify(otp)}} className="space-y-5">
  <p className="break-words text-sm text-muted-foreground">Enter the six-digit code sent to <span className="font-medium text-foreground">{identity}</span>.</p>
  <OTPInput value={otp} onChange={setOtp} onComplete={value=>void verify(value)} disabled={busy}/>
  <Button type="submit" className="w-full" disabled={busy||!/^\d{6}$/.test(otp)}>{busy?'Verifying…':'Verify and sign in'}</Button>
  <div className="flex flex-wrap justify-between gap-2"><Button type="button" variant="ghost" disabled={busy||remaining>0} onClick={()=>void send(identity)}>{remaining>0?'Resend in '+remaining+'s':'Resend code'}</Button><Button type="button" variant="ghost" disabled={busy} onClick={()=>{setIdentity(null);setOtp('');setError(null)}}>Change {AUTH_MODE}</Button></div>
  <p className="text-xs leading-5 text-muted-foreground">Delivery can take a moment. {AUTH_MODE==='email'?'Check your spam folder too. ':''}Your provider may require a longer wait between requests.</p>
 </form>}
 {error&&<p className="mt-4 text-sm text-destructive" role="alert">{error}</p>}
 </div>
}
