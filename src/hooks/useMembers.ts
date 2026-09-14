import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useGym } from '@/hooks/useGym'


export type MemberRole = 'owner' | 'admin' | 'receptionist' | 'trainer' | 'member'
export type MembershipStatus = 'active' | 'frozen' | 'scheduled' | 'expired' | 'cancelled' | 'none'

export type MemberListItem = {
  id: string
  profile_id: string
  member_code: string | null
  role: MemberRole
  is_active: boolean
  joined_at: string
  profiles: {
    id: string
    full_name: string
    email: string | null
    phone: string | null
    avatar_url: string | null
  }
  active_membership?: {
    id: string
    status: string
    end_date: string
    plan_name: string
  }
}

export function useMembers() {
  const { gym } = useGym()
  const [members, setMembers] = useState<MemberListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchMembers = useCallback(async () => {
    if (!gym || !supabase) return
    setLoading(true)
    setError(null)

    try {
      // Fetch members independently so rows without a membership can never be filtered out.
      const { data: memberRows, error: fetchError } = await supabase
        .from('gym_members')
        .select(`
          id, profile_id, member_code, role, is_active, joined_at,
          profiles ( id, full_name, email, phone, avatar_url )
        `)
        .eq('gym_id', gym.gym_id)
        .eq('role', 'member')
        .eq('is_active', true)
        .order('joined_at', { ascending: false })

      if (fetchError) throw fetchError

      const rows = (memberRows ?? []) as unknown as MemberListItem[]
      setMembers(rows)

      const memberIds = rows.map(row => row.id)

      if (memberIds.length > 0) {
        const { data, error: membershipError } = await supabase
          .from('memberships')
          .select('id, member_id, status, start_date, end_date, plan_id, membership_plans ( name )')
          .eq('gym_id', gym.gym_id)
          .in('member_id', memberIds)
          .in('status', ['active', 'frozen', 'scheduled'])
          .order('created_at', { ascending: false })

        // Membership status is optional enrichment. Never hide valid member rows
        // because this secondary request failed or returned no matches.
        if (!membershipError) {
          const membershipByMember = new Map<string, any>()
          for (const membership of (data ?? []) as any[]) {
            if (!membershipByMember.has(membership.member_id)) {
              membershipByMember.set(membership.member_id, membership)
            }
          }

          setMembers(rows.map(member => {
            const activeMb = membershipByMember.get(member.id)
            if (!activeMb) return member
            return {
              ...member,
              active_membership: {
                id: activeMb.id,
                status: activeMb.status,
                end_date: activeMb.end_date,
                plan_name: activeMb.membership_plans?.name || 'Unknown Plan'
              }
            }
          }))
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch members')
    } finally {
      setLoading(false)
    }
  }, [gym])

  const fetchMember = useCallback(async (id: string) => {
    if (!gym || !supabase) throw new Error('Not initialized')
    
    const { data, error: fetchError } = await supabase
      .from('gym_members')
      .select(`
        id, gym_id, profile_id, role, member_code, is_active, joined_at, created_at, updated_at,
        profiles (
          id, full_name, email, phone, avatar_url, date_of_birth, gender, address,
          emergency_contact_name, emergency_contact_phone
        ),
        memberships!memberships_member_id_fkey (
          id, gym_id, member_id, plan_id, payment_id, status, start_date, end_date,
          original_end_date, frozen_at, frozen_until, freeze_count, total_freeze_days,
          notes, created_by, cancelled_at, cancelled_by, cancellation_reason, created_at, updated_at,
          membership_plans!memberships_plan_id_fkey (name, duration_type, duration_value)
        ),
        payments!payments_member_id_fkey (
          id, gym_id, member_id, plan_id, requested_start_date, amount, discount_amount,
          taxable_amount, gst_rate, cgst_amount, sgst_amount, total_amount, currency,
          razorpay_order_id, razorpay_payment_id, status, promo_code_id, description,
          created_by, created_at, updated_at,
          invoices!invoices_payment_id_fkey (id, invoice_number)
        ),
        attendance!attendance_member_id_fkey (
          id, gym_id, member_id, check_in_at, check_out_at, method, device_id, created_at
        )
      `)
      .eq('gym_id', gym.gym_id)
      .eq('id', id)
      .single()

    if (fetchError) throw fetchError
    return data as any
  }, [gym])

  const recordManualAttendance = useCallback(async (memberId: string) => {
    if (!gym || !supabase) throw new Error('Not initialized')
    
    const { error } = await supabase
      .from('attendance')
      .insert({
        gym_id: gym.gym_id,
        member_id: memberId,
        method: 'manual',
      })
      
    if (error) throw error
  }, [gym])

  const deactivateMember = useCallback(async (id: string) => {
    if (!gym || !supabase) throw new Error('Not initialized')
    
    const { error } = await supabase
      .from('gym_members')
      .update({ is_active: false })
      .eq('id', id)
      .eq('gym_id', gym.gym_id)
      
    if (error) throw error
    setMembers(prev => prev.filter(m => m.id !== id))
  }, [gym])

  return {
    members,
    loading,
    error,
    fetchMembers,
    fetchMember,
    recordManualAttendance,
    deactivateMember
  }
}
