import { useState } from 'react'
import { Navigate,useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import { useGym } from '@/hooks/useGym'
import { authError,dashboardPath } from '@/lib/auth'
import AuthCard from '@/components/auth/AuthCard'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
export default function NoGymPage(){
 const auth=useAuth();const {gym,isSuperAdmin,refreshGyms}=useGym();const navigate=useNavigate();const [slug,setSlug]=useState('')
 if(gym||isSuperAdmin)return <Navigate to={dashboardPath(gym?.role??null,isSuperAdmin)} replace/>
 return <AuthCard title="Find your gym" description="Your profile is ready. Ask your gym for its join link, or enter the gym code from that link.">
 <form className="space-y-4" onSubmit={e=>{e.preventDefault();if(/^[a-z0-9-]{1,160}$/.test(slug.trim()))navigate('/join/'+slug.trim());else toast.error('Enter the gym code, for example fitstack-studio.')}}><Label htmlFor="gym-code">Gym code</Label><Input id="gym-code" value={slug} onChange={e=>setSlug(e.target.value)} placeholder="fitstack-studio"/><Button className="w-full" type="submit">Find gym</Button></form>
 <Button variant="ghost" className="mt-3" onClick={()=>void refreshGyms().catch(e=>toast.error(authError(e)))}>Refresh gym access</Button><Button variant="ghost" onClick={()=>void auth.signOut().catch(e=>toast.error(authError(e)))}>Sign out</Button>
 </AuthCard>
}
