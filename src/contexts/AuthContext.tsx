import { createContext, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase, previewAvailable } from '@/lib/supabase'
import { AUTH_MODE, authError, isProfileComplete, onboardingSchema, otpRequest, otpVerification, type OnboardingValues } from '@/lib/auth'
import type { Database } from '@/types/database'
import type { Role } from '@/types'
type Profile = Database['public']['Tables']['profiles']['Row']
type AuthState = {
 session: Session | null; user: User | null; profile: Profile | null; loading: boolean; error: string | null;
 isAuthenticated: boolean; isOnboarded: boolean;
 previewRole: Role | 'super_admin' | null; setPreviewRole: (role: Role | 'super_admin' | null) => void;
 signIn: (identity: string) => Promise<void>; verifyOtp: (identity: string, otp: string) => Promise<void>;
 signOut: () => Promise<void>; refreshProfile: () => void; saveProfile: (values: OnboardingValues) => Promise<void>;
}
export const AuthContext = createContext<AuthState | null>(null)
export function AuthProvider({ children }: { children: ReactNode }) {
 const [session, setSession] = useState<Session | null>(null)
 const current = useRef<Session | null>(null)
 const [initializing, setInitializing] = useState(Boolean(supabase))
 const [sessionError, setSessionError] = useState<string | null>(null)
 const [profileState, setProfileState] = useState<{ owner: string; value: Profile | null; error: string | null } | null>(null)
 const [profileLoading, setProfileLoading] = useState(false)
 const [reload, setReload] = useState(0)
 const [previewRole, setPreview] = useState<AuthState['previewRole']>(null)
 useEffect(() => {
  if (!supabase) return
  let alive = true; let revision = 0
  const receive = (next: Session | null, clearPreview = false) => {
   if (!alive) return
   current.current = next; setSession(next); setInitializing(false); setSessionError(null)
   if (!next) setProfileState(null)
   if (next || clearPreview) setPreview(null)
  }
  // The callback stays synchronous; profile work runs outside the SDK's auth lock.
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, next) => { revision++; receive(next, event === 'SIGNED_OUT') })
  const initialRevision = revision
  supabase.auth.getSession().then(({ data, error }) => {
   if (!alive || initialRevision !== revision) return
   receive(data.session)
   if (error) setSessionError(authError(error))
  }).catch(e => { if (alive && initialRevision === revision) { setSessionError(authError(e)); setInitializing(false) } })
  return () => { alive = false; subscription.unsubscribe() }
 }, [])
 const userId = session?.user.id
 useEffect(() => {
  if (!supabase || !userId) return
  let alive = true
  setProfileLoading(true)
  supabase.rpc('ensure_my_profile').single().then(({ data, error }) => {
   if (!alive) return
   setProfileState({ owner: userId, value: error ? null : data, error: error ? authError(error) : null })
   setProfileLoading(false)
  }, e => { if (alive) { setProfileState({ owner: userId, value: null, error: authError(e) }); setProfileLoading(false) } })
  return () => { alive = false }
 }, [userId, session?.access_token, reload])
 const signIn = useCallback(async (identity: string) => {
  if (!supabase) throw new Error('Supabase is not configured')
  const { error } = await supabase.auth.signInWithOtp(otpRequest(identity, AUTH_MODE))
  if (error) throw error
 }, [])
 const verifyOtp = useCallback(async (identity: string, otp: string) => {
  if (!supabase) throw new Error('Supabase is not configured')
  const { error } = await supabase.auth.verifyOtp(otpVerification(identity, otp, AUTH_MODE))
  if (error) throw error
 }, [])
 const signOut = useCallback(async () => {
  if (supabase) { const { error } = await supabase.auth.signOut(); if (error) throw error }
  current.current = null; setSession(null); setProfileState(null); setPreview(null)
 }, [])
 const refreshProfile = useCallback(() => setReload(n => n + 1), [])
 const saveProfile = useCallback(async (raw: OnboardingValues) => {
  const account = current.current
  if (!supabase || !account) throw new Error('Sign in required')
  const values = onboardingSchema.parse(raw)
  const { data, error } = await supabase.from('profiles').update({
   full_name: values.full_name, email: values.email || null, date_of_birth: values.date_of_birth || null,
   gender: values.gender || null, emergency_contact_name: values.emergency_contact_name || null,
   emergency_contact_phone: values.emergency_contact_phone ? otpRequest(values.emergency_contact_phone, 'phone').phone : null,
  }).eq('id', account.user.id).select('*').single()
  if (error) throw error
  if (current.current?.user.id !== account.user.id) throw new Error('Sign in required')
  setProfileState({ owner: account.user.id, value: data, error: null })
 }, [])
 const profile = userId && profileState?.owner === userId ? profileState.value : null
 const loading = !previewRole && (initializing || (!!userId && (profileLoading || profileState?.owner !== userId)))
 const setPreviewRole: AuthState['setPreviewRole'] = role => { if ((!current.current && previewAvailable) || role === null) setPreview(role) }
 return <AuthContext.Provider value={{
  session, user: session?.user ?? null, profile, loading,
  error: sessionError ?? (userId && profileState?.owner === userId ? profileState.error : null),
  isAuthenticated: !!session || !!previewRole, isOnboarded: !!previewRole || isProfileComplete(profile),
  previewRole, setPreviewRole, signIn, verifyOtp, signOut, refreshProfile, saveProfile,
 }}>{children}</AuthContext.Provider>
}
