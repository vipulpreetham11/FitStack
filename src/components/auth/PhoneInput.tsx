import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
export default function PhoneInput({ value,onChange,disabled=false,onBlur,error,id='phone' }: { value:string; onChange:(value:string)=>void; disabled?:boolean; onBlur?:()=>void; error?:string; id?:string }) {
 const digits = value.replace(/\D/g,'').slice(0,10)
 const display = digits.length > 5 ? digits.slice(0,5)+' '+digits.slice(5) : digits
 return <div className="grid gap-2"><Label htmlFor={id}>Mobile number</Label>
  <div className="flex overflow-hidden rounded-md border focus-within:ring-2 focus-within:ring-ring">
   <span className="flex items-center bg-muted px-3 text-sm" aria-hidden="true">+91</span>
   <Input id={id} type="tel" inputMode="tel" autoComplete="tel-national" aria-label="Mobile number, India +91" aria-invalid={!!error} aria-describedby={error?id+'-error':undefined} className="min-w-0 rounded-none border-0" value={display}
    onChange={e=>{let next=e.target.value.replace(/\D/g,'');if(next.length===12&&next.startsWith('91'))next=next.slice(2);onChange(next.slice(0,10))}} onBlur={onBlur} disabled={disabled} placeholder="98765 43210"/>
  </div>{error && <p id={id+'-error'} role="alert" className="text-sm text-destructive">{error}</p>}
 </div>
}
