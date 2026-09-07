import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

export type SuperGym = { id: string; name: string; slug: string; city: string | null; is_active: boolean; members_count: number; active_memberships: number; revenue_this_month: number; created_at: string }
export type SuperGymMember = { id: string; member_code: string | null; role: string; is_active: boolean; joined_at: string; full_name: string; phone: string | null; email: string | null }
export type SuperGymPayment = { id: string; created_at: string; description: string | null; total_amount: number; status: string; member_name: string }
export type SuperGymDetail = { gym: { id: string; name: string; slug: string; logo_url: string | null; brand_color: string; address: string | null; city: string | null; state: string | null; pincode: string | null; phone: string | null; email: string | null; website: string | null; gstin: string | null; is_active: boolean; razorpay_configured: boolean; created_at: string }; members: SuperGymMember[]; financials: { revenue_this_month: number; captured_payments: number; failed_payments: number; pending_payments: number }; recent_payments: SuperGymPayment[] }
const previewGym: SuperGym = { id: 'preview', name: 'FitStack Studio', slug: 'preview', city: 'Hyderabad', is_active: true, members_count: 0, active_memberships: 0, revenue_this_month: 0, created_at: new Date().toISOString() }
const previewDetail: SuperGymDetail = { gym: { id: 'preview', name: 'FitStack Studio', slug: 'preview', logo_url: null, brand_color: '#171717', address: null, city: 'Hyderabad', state: 'Telangana', pincode: null, phone: null, email: null, website: null, gstin: null, is_active: true, razorpay_configured: false, created_at: previewGym.created_at }, members: [], financials: { revenue_this_month: 0, captured_payments: 0, failed_payments: 0, pending_payments: 0 }, recent_payments: [] }

export function useSuperAdmin() {
  const [gyms, setGyms] = useState<SuperGym[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null)
  const refresh = useCallback(async () => {
    if (!supabase) { setGyms([previewGym]); setLoading(false); return }
    setLoading(true); setError(null)
    const { data, error: rpcError } = await (supabase as any).rpc('get_super_admin_gyms')
    if (rpcError) setError(rpcError.message); else setGyms((data ?? []).map((row: any) => ({ ...row, members_count: Number(row.members_count), active_memberships: Number(row.active_memberships), revenue_this_month: Number(row.revenue_this_month) })))
    setLoading(false)
  }, [])
  useEffect(() => { void refresh() }, [refresh])
  const getGymDetail = useCallback(async (id: string): Promise<SuperGymDetail> => {
    if (!supabase) return { ...previewDetail, gym: { ...previewDetail.gym, id } }
    const { data, error: rpcError } = await (supabase as any).rpc('get_super_admin_gym_detail', { p_gym_id: id })
    if (rpcError) throw rpcError; return data as SuperGymDetail
  }, [])
  const setGymActive = useCallback(async (id: string, active: boolean) => {
    if (!supabase) { setGyms(rows => rows.map(row => row.id === id ? { ...row, is_active: active } : row)); return }
    const { error: rpcError } = await (supabase as any).rpc('set_gym_active', { p_gym_id: id, p_active: active })
    if (rpcError) throw rpcError; setGyms(rows => rows.map(row => row.id === id ? { ...row, is_active: active } : row))
  }, [])
  const platformStats = useMemo(() => ({ totalGyms: gyms.length, activeGyms: gyms.filter(g => g.is_active).length, totalMembers: gyms.reduce((sum, g) => sum + g.members_count, 0), platformRevenue: gyms.reduce((sum, g) => sum + g.revenue_this_month, 0) }), [gyms])
  return { gyms, loading, error, refresh, getGymDetail, setGymActive, platformStats }
}
