import { useEffect,useRef } from 'react'
import { Input } from '@/components/ui/input'
export default function OTPInput({value,onChange,onComplete,disabled=false}: {value:string;onChange:(value:string)=>void;onComplete?:(value:string)=>void;disabled?:boolean}) {
 const inputs=useRef<(HTMLInputElement|null)[]>([])
 useEffect(()=>{inputs.current[0]?.focus()},[])
 const enter=(index:number,text:string)=>{
  const digits=text.replace(/\D/g,'')
  if(!digits)return
  const next=value.padEnd(6,' ').split('')
  const start=digits.length===6?0:index
  digits.slice(0,6-start).split('').forEach((digit,i)=>{next[start+i]=digit})
  const result=next.join('').trimEnd()
  onChange(result)
  inputs.current[Math.min(start+digits.length,5)]?.focus()
  if(/^\d{6}$/.test(result))onComplete?.(result)
 }
 return <fieldset disabled={disabled}><legend className="mb-2 text-sm font-medium">Verification code</legend>
  <div className="grid grid-cols-6 gap-1 sm:gap-2">{Array.from({length:6},(_,i)=><Input key={i} ref={el=>{inputs.current[i]=el}} aria-label={'Digit '+(i+1)} type="text" inputMode="numeric" autoComplete={i===0?'one-time-code':'off'} maxLength={6} value={value[i]?.trim()??''} className="h-12 min-w-0 px-0 text-center text-xl tabular-nums"
   onFocus={e=>e.target.select()}
   onChange={e=>{if(e.target.value)enter(i,e.target.value);else{const next=value.padEnd(6,' ').split('');next[i]=' ';onChange(next.join('').trimEnd())}}}
   onPaste={e=>{e.preventDefault();enter(i,e.clipboardData.getData('text'))}}
   onKeyDown={e=>{
    if(e.key==='Backspace'){e.preventDefault();const next=value.padEnd(6,' ').split('');const at=next[i]!==' '?i:Math.max(0,i-1);next[at]=' ';onChange(next.join('').trimEnd());inputs.current[at]?.focus()}
    if(e.key==='ArrowLeft')inputs.current[Math.max(0,i-1)]?.focus()
    if(e.key==='ArrowRight')inputs.current[Math.min(5,i+1)]?.focus()
   }}
  />)}</div>
 </fieldset>
}
