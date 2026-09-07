import type { ReactNode } from 'react'
import { Navigate,Outlet,useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import { useGym } from '@/hooks/useGym'
import { authError,dashboardPath } from '@/lib/auth'
import type { Role } from '@/types'
import { Button } from '@/components/ui/button'
export default function RouteGuard({roles,permission,requiredRole,requiredPermission,superAdminOnly=false,authOnly=false,allowIncomplete=false,children,redirectTo='/login'}: {roles?:Role[];permission?:string;requiredRole?:Role[];requiredPermission?:string;superAdminOnly?:boolean;authOnly?:boolean;allowIncomplete?:boolean;children?:ReactNode;redirectTo?:string}){
 const auth=useAuth();const access=useGym();const location=useLocation()
 if(auth.loading||(!authOnly&&access.loading))return <div className="p-8" role="status">Loading your workspace…</div>
 if(!auth.isAuthenticated)return <Navigate to={redirectTo} replace state={{from:location.pathname+location.search}}/>
 const error=auth.error??(!authOnly?access.error:null)
 if(error)return <div className="space-y-4 p-8" role="alert"><p>{error}</p><Button onClick={()=>{if(auth.error)auth.refreshProfile();else void access.refreshGyms().catch(e=>toast.error(authError(e)))}}>Retry</Button><Button variant="ghost" onClick={()=>void auth.signOut().catch(e=>toast.error(authError(e)))}>Sign out</Button></div>
 if(!allowIncomplete&&!auth.isOnboarded)return <Navigate to={'/onboarding?next='+encodeURIComponent(location.pathname+location.search)} replace/>
 if(authOnly)return children??<Outlet/>
 const {gym,isSuperAdmin}=access
 const denied=<Navigate to={dashboardPath(gym?.role??null,isSuperAdmin)} replace state={{denied:true}}/>
 if(superAdminOnly&&!isSuperAdmin)return denied
 if(!superAdminOnly&&!gym&&!isSuperAdmin)return <Navigate to="/no-gym" replace/>
 if(gym&&!gym.is_active&&!isSuperAdmin&&!['owner','admin'].includes(gym.role))return <div className="space-y-4 p-8"><h1 className="text-2xl font-semibold">Gym subscription inactive</h1><p>Contact your gym to restore access.</p>{access.gyms.filter(g=>g.is_active).map(g=><Button key={g.gym_id} variant="outline" onClick={()=>access.switchGym(g.gym_id)}>Switch to {g.name}</Button>)}<Button variant="ghost" onClick={()=>void auth.signOut().catch(e=>toast.error(authError(e)))}>Sign out</Button></div>
 const allowedRoles=requiredRole??roles;const allowedPermission=requiredPermission??permission
 if(allowedRoles&&!isSuperAdmin&&(!gym||!allowedRoles.includes(gym.role)))return denied
 if(allowedPermission&&!access.hasPermission(allowedPermission))return denied
 return <>{gym&&!gym.is_active&&!isSuperAdmin&&<div role="status" className="border-b bg-muted px-5 py-3 text-sm">Subscription inactive — your gym is read-only until reactivated.</div>}{children??<Outlet/>}</>
}
