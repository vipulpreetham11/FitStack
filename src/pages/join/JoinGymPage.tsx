import { useEffect, useState, type CSSProperties } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import AuthCard from '@/components/auth/AuthCard'
import LoginForm from '@/components/auth/LoginForm'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { useGym } from '@/hooks/useGym'
import { authError, dashboardPath } from '@/lib/auth'
import { brandVariables } from '@/lib/brand'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'

type JoinGym = Database['public']['Functions']['get_join_gym']['Returns'][number]

export default function JoinGymPage() {
  const { slug = '' } = useParams()
  const auth = useAuth()
  const { refreshGyms, isSuperAdmin } = useGym()
  const [lookup, setLookup] = useState<{ slug: string; gym: JoinGym | null; error: string | null } | null>(null)
  const [result, setResult] = useState<{ slug: string; user: string; path?: string; error?: string } | null>(null)
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    let alive = true
    if (!supabase) {
      setLookup({ slug, gym: null, error: 'Add your Supabase configuration to resolve this gym.' })
      return
    }
    supabase.rpc('get_join_gym', { p_slug: slug }).maybeSingle().then(({ data, error }) => {
      if (alive) setLookup({ slug, gym: data, error: error ? authError(error) : null })
    }, cause => {
      if (alive) setLookup({ slug, gym: null, error: authError(cause) })
    })
    return () => { alive = false }
  }, [slug, retry])

  const gym = lookup?.slug === slug ? lookup.gym : null
  const userId = auth.user?.id

  useEffect(() => {
    if (!supabase || !gym || !userId || !auth.isOnboarded || auth.loading || auth.error) return
    let alive = true
    const gymName = gym.name
    const joiningUserId = userId

    async function join() {
      const { data: joinedId, error: joinError } = await supabase!.rpc('join_gym', { p_slug: slug })
      if (joinError) throw joinError
      if (!alive) return

      const rows = await refreshGyms(joinedId)
      if (!alive) return
      const membership = rows.find(row => row.gym_id === joinedId)
      if (!membership) throw new Error('Unable to load gym access')
      if (!membership.member_code) throw new Error('Unable to assign member code')

      if (!alive) return
      toast.success(`Welcome to ${gymName}`, { id: 'joined-gym' })
      setResult({ slug, user: joiningUserId, path: dashboardPath(membership.role, isSuperAdmin) })
    }

    void join().catch(cause => {
      if (!alive) return
      const error = authError(cause)
      setResult({ slug, user: joiningUserId, error })
      toast.error(error)
    })
    return () => { alive = false }
  }, [gym, userId, auth.isOnboarded, auth.loading, auth.error, auth.profile?.full_name, slug, refreshGyms, isSuperAdmin, retry])

  const currentResult = result?.slug === slug && result.user === userId ? result : null
  if (currentResult?.path) return <Navigate to={currentResult.path} replace />
  if (gym && auth.isAuthenticated && !auth.loading && !auth.error && !auth.isOnboarded) {
    return <Navigate to={`/onboarding?next=${encodeURIComponent(`/join/${slug}`)}`} replace />
  }

  return (
    <AuthCard
      title={gym ? `Join ${gym.name}` : lookup?.slug !== slug ? 'Finding your gym…' : lookup.error ? 'Unable to load gym' : 'Gym not found'}
      name={gym?.name}
      logo={gym?.logo_url}
      style={brandVariables(gym?.brand_color) as CSSProperties}
      description={gym ? 'Your next chapter starts here. Sign in to join this gym.' : undefined}
    >
      {lookup?.slug !== slug ? <p role="status">Loading gym details…</p>
        : lookup.error ? <p role="alert">{lookup.error}</p>
        : !gym ? <p>This join link is unavailable or the gym subscription is inactive. Ask your gym for a current link.</p>
        : auth.error ? <p role="alert">{auth.error}</p>
        : auth.loading ? <p role="status">Loading your profile…</p>
        : auth.previewRole ? <p>Exit the development preview and sign in to join a real gym.</p>
        : !auth.isAuthenticated ? <LoginForm />
        : currentResult?.error ? <p role="alert">{currentResult.error}</p>
        : <p role="status">Joining your gym…</p>}
      {(lookup?.error || currentResult?.error || auth.error) && (
        <Button className="mt-4" onClick={() => { setResult(null); setRetry(value => value + 1); if (auth.error) auth.refreshProfile() }}>Retry</Button>
      )}
      {auth.isAuthenticated && <Button className="mt-4" variant="ghost" onClick={() => void auth.signOut().catch(cause => toast.error(authError(cause)))}>Sign out</Button>}
    </AuthCard>
  )
}
