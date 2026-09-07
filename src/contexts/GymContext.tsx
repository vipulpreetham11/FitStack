import { createContext, useCallback, useEffect, useState, type ReactNode } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { hasPermission as checkPermission } from '@/lib/constants'
import { brandVariables } from '@/lib/brand'
import { authError } from '@/lib/auth'
import type { Database } from '@/types/database'
import type { Role } from '@/types'
type AccessRow = Database['public']['Functions']['get_my_gym_access']['Returns'][number]
export type GymAccess = Omit<AccessRow, 'role' | 'brand_color'> & { role: Role; brand_color: string }
type GymMember = Omit<Database['public']['Tables']['gym_members']['Row'], 'qr_secret'>
type GymState = {
 gym: GymAccess | null; gymMember: GymMember | null; role: Role | null; gyms: GymAccess[];
 selectGym: (id: string) => void; switchGym: (id: string) => void; refreshGyms: (selectId?: string) => Promise<GymAccess[]>;
 loading: boolean; isSuperAdmin: boolean; error: string | null; hasPermission: (permission: string) => boolean;
}
export const GymContext = createContext<GymState | null>(null)
export function GymProvider({ children }: { children: ReactNode }) {
 const { user, profile, loading: authLoading, previewRole } = useAuth()
 const userId = user?.id ?? null
 const [state, setState] = useState<{ owner: string; gyms: GymAccess[]; error: string | null } | null>(null)
 const [selected, setSelected] = useState<{ owner: string; id: string } | null>(null)
 const [reload, setReload] = useState(0)
 const refreshGyms = useCallback(async (selectId?: string) => {
  if (!supabase || !userId) return []
  const { data, error } = await supabase.rpc('get_my_gym_access')
  if (error) throw error
  const rows = data.map(row => ({ ...row, role: row.role as Role, brand_color: row.brand_color ?? '#171717' }))
  setState({ owner: userId, gyms: rows, error: null })
  if (selectId) setSelected({ owner: userId, id: selectId })
  return rows
 }, [userId])
 useEffect(() => {
  if (!supabase || !userId || authLoading || !profile) return
  let alive = true
  supabase.rpc('get_my_gym_access').then(({data,error}) => {
   if (alive) setState({ owner: userId, gyms: error ? [] : data.map(row => ({...row, role: row.role as Role, brand_color: row.brand_color ?? '#171717'})), error: error ? authError(error) : null })
  }, e => { if (alive) setState({owner:userId,gyms:[],error:authError(e)}) })
  return () => { alive = false }
 }, [userId, authLoading, profile, reload])
 useEffect(() => {
  const refresh = () => { if (document.visibilityState === 'visible') setReload(n => n+1) }
  window.addEventListener('focus',refresh)
  return () => window.removeEventListener('focus',refresh)
 }, [])
 const visible = userId && state?.owner === userId ? state.gyms : []
 const preview: GymAccess | null = previewRole ? { id:'preview',gym_id:'preview',profile_id:'preview',role:previewRole==='super_admin'?'owner':previewRole,name:'FitStack Studio',slug:'preview',logo_url:null,brand_color:'#171717',is_active:true,member_is_active:true,member_code:null,joined_at:'',created_at:'',updated_at:'' } : null
 const gym = preview ?? visible.find(g => selected?.owner === userId && g.gym_id === selected.id) ?? visible[0] ?? null
 const isSuperAdmin = previewRole === 'super_admin' || profile?.is_super_admin === true
 const switchGym = (id: string) => { if (userId && visible.some(g => g.gym_id === id)) setSelected({owner:userId,id}) }
 useEffect(() => {
  for (const [name,value] of Object.entries(brandVariables(gym?.brand_color))) document.documentElement.style.setProperty(name,value)
 }, [gym?.brand_color])
 const gymMember = gym ? { id:gym.id,gym_id:gym.gym_id,profile_id:gym.profile_id,role:gym.role,member_code:gym.member_code,is_active:gym.member_is_active,joined_at:gym.joined_at,created_at:gym.created_at,updated_at:gym.updated_at } : null
 return <GymContext.Provider value={{gym,gymMember,role:gym?.role ?? null,gyms:preview?[preview]:visible,selectGym:switchGym,switchGym,refreshGyms,
  loading:!previewRole && !!userId && !!profile && (authLoading || state?.owner!==userId),
  isSuperAdmin,error:userId && state?.owner===userId?state.error:null,
  hasPermission: permission => checkPermission(gym?.role ?? null,permission,isSuperAdmin),
 }}>{children}</GymContext.Provider>
}
