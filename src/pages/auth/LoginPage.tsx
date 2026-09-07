import { Navigate,useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useGym } from '@/hooks/useGym'
import { dashboardPath,safeReturnPath } from '@/lib/auth'
import { previewAvailable } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import AuthCard from '@/components/auth/AuthCard'
import LoginForm from '@/components/auth/LoginForm'
export default function LoginPage(){
 const auth=useAuth();const {role,isSuperAdmin,loading}=useGym();const location=useLocation()
 const next=safeReturnPath(new URLSearchParams(location.search).get('next'))??safeReturnPath(location.state?.from)
 if(auth.loading||loading)return <AuthCard title="Signing you in"><p role="status">Loading your workspace…</p></AuthCard>
 if(auth.isAuthenticated&&!auth.error)return <Navigate to={!auth.isOnboarded?'/onboarding'+(next?'?next='+encodeURIComponent(next):''):next??dashboardPath(role,isSuperAdmin)} replace/>
 return <AuthCard title="Sign in to FitStack" description="A one-time code. No password to remember.">
  {auth.error?<div role="alert"><p>{auth.error}</p><Button className="mt-4" onClick={auth.refreshProfile}>Retry profile</Button><Button variant="ghost" onClick={()=>void auth.signOut()}>Sign out</Button></div>:<LoginForm/>}
  {previewAvailable&&!auth.session&&<details className="mt-8 border-t pt-5"><summary className="cursor-pointer text-sm text-muted-foreground">Development scaffold previews</summary><p className="my-3 text-xs text-muted-foreground">No real session or database access.</p><div className="flex flex-wrap gap-2">{(['owner','receptionist','trainer','member','super_admin'] as const).map(previewRole=><Button key={previewRole} variant="outline" size="sm" onClick={()=>auth.setPreviewRole(previewRole)}>{previewRole.replace('_',' ')}</Button>)}</div></details>}
 </AuthCard>
}
