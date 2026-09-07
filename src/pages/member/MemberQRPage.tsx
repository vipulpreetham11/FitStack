import { useCallback, useEffect, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useGym } from '@/hooks/useGym'

type QrStage = 'loading' | 'ready' | 'refreshing' | 'error'

function devToken(gymId: string, memberId: string) {
  return `${gymId}:${memberId}:${Math.floor(Date.now() / 1000)}:dev-mode`
}

export default function MemberQRPage() {
  const { user } = useAuth()
  const { gym, gymMember } = useGym()
  const [token, setToken] = useState<string | null>(null)
  const [stage, setStage] = useState<QrStage>('loading')
  const [secondsLeft, setSecondsLeft] = useState(55)
  const [devMode, setDevMode] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchToken = useCallback(async (quiet = false) => {
    if (!gym || !gymMember || !user) return
    if (!quiet) setStage('loading')
    else setStage('refreshing')
    try {
      if (!supabase) throw new Error('not-configured')
      const { data, error } = await supabase.functions.invoke('generate-qr-token', { body: { gym_id: gym.gym_id } })
      if (error || !data?.token) throw error ?? new Error('no-token')
      setToken(data.token as string)
      setDevMode(false)
      setStage('ready')
      setSecondsLeft(55)
    } catch {
      // Fallback: dev-mode token
      setToken(devToken(gym.gym_id, gymMember.id))
      setDevMode(true)
      setStage('ready')
      setSecondsLeft(55)
    }
  }, [gym, gymMember, user])

  useEffect(() => { void fetchToken() }, [fetchToken])

  // Countdown + auto-refresh
  useEffect(() => {
    if (stage !== 'ready') return
    timerRef.current = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) { void fetchToken(true); return 55 }
        return prev - 1
      })
    }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [stage, fetchToken])

  const circumference = 2 * Math.PI * 44
  const progress = secondsLeft / 55
  const strokeDash = circumference * (1 - progress)

  const initials = (gym?.name ?? 'GY').slice(0, 2).toUpperCase()

  return (
    // Force white background regardless of dark mode — QR codes scan better
    <div className="fixed inset-0 bg-white flex flex-col items-center justify-start overflow-y-auto" style={{ color: '#171717' }}>
      {/* Gym header */}
      <div className="mt-10 flex flex-col items-center gap-2">
        {gym?.logo_url ? (
          <img src={gym.logo_url} alt={gym.name} className="h-12 w-12 rounded-xl object-cover" />
        ) : (
          <div className="h-12 w-12 rounded-xl flex items-center justify-center text-white text-sm font-bold" style={{ background: gym?.brand_color ?? '#171717' }}>{initials}</div>
        )}
        <p className="text-sm font-medium text-gray-500">{gym?.name ?? 'Your Gym'}</p>
      </div>

      {/* Member name */}
      <div className="mt-6 text-center px-6">
        <p className="text-2xl font-semibold tracking-tight">{gymMember ? 'Your Entry QR' : 'Loading...'}</p>
      </div>

      {/* QR area with countdown ring */}
      <div className="mt-8 relative flex items-center justify-center">
        <svg className="absolute" width="300" height="300" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="44" fill="none" stroke="#e5e7eb" strokeWidth="3" />
          <circle
            cx="50" cy="50" r="44" fill="none"
            stroke={stage === 'refreshing' ? '#d1d5db' : '#171717'} strokeWidth="3"
            strokeDasharray={`${circumference}`}
            strokeDashoffset={strokeDash}
            strokeLinecap="round"
            transform="rotate(-90 50 50)"
            style={{ transition: 'stroke-dashoffset 0.9s linear' }}
          />
        </svg>

        <div className={`relative z-10 p-5 bg-white rounded-2xl shadow-sm transition-opacity duration-500 ${stage === 'refreshing' ? 'opacity-40' : 'opacity-100'}`}>
          {(stage === 'loading') ? (
            <div className="w-[250px] h-[250px] flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
            </div>
          ) : token ? (
            <QRCodeSVG value={token} size={250} bgColor="#ffffff" fgColor="#171717" level="M" />
          ) : null}
        </div>
      </div>

      {/* Countdown */}
      {stage === 'ready' && (
        <p className="mt-4 text-sm text-gray-400">Refreshes in {secondsLeft}s</p>
      )}

      {/* Instruction */}
      <p className="mt-6 text-base font-medium text-gray-700 text-center px-8">Show this to the front desk</p>

      {/* Dev mode banner */}
      {devMode && (
        <div className="mt-6 mx-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 text-center">
          Dev mode — QR not cryptographically signed
        </div>
      )}

      <div className="h-16" />
    </div>
  )
}