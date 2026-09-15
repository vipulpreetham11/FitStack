import { useCallback, useEffect, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '@/lib/supabase'
import { useGym } from '@/hooks/useGym'

type QrStage = 'loading' | 'ready' | 'refreshing' | 'error'

type QrTokenResponse = {
  token: string
  member_id: string
  gym_id: string
  expires_in: number
}

export default function MemberQRPage() {
  const { gym, gymMember } = useGym()
  const [qrPayload, setQrPayload] = useState<string | null>(null)
  const [stage, setStage] = useState<QrStage>('loading')
  const [secondsLeft, setSecondsLeft] = useState(60)
  const [tokenLifetime, setTokenLifetime] = useState(60)
  const [refreshAt, setRefreshAt] = useState<number | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchToken = useCallback(async (quiet = false) => {
    if (!gym) return
    if (!quiet) setStage('loading')
    else setStage('refreshing')
    setErrorMessage(null)

    try {
      if (!supabase) throw new Error('QR service is not configured')

      const { data, error } = await supabase.functions.invoke('generate-qr-token', {
        body: { gym_id: gym.gym_id },
      })

      if (error) throw error

      const response = data as Partial<QrTokenResponse> | null
      if (
        !response ||
        typeof response.token !== 'string' ||
        typeof response.member_id !== 'string' ||
        typeof response.gym_id !== 'string' ||
        typeof response.expires_in !== 'number' ||
        !Number.isFinite(response.expires_in) ||
        response.expires_in <= 0
      ) {
        throw new Error('The QR service returned an invalid response')
      }

      const expiresIn = Math.max(1, Math.ceil(response.expires_in))
      setQrPayload(`fitstack:${response.gym_id}:${response.member_id}:${response.token}`)
      setTokenLifetime(expiresIn)
      setSecondsLeft(expiresIn)
      setRefreshAt(Date.now() + expiresIn * 1000)
      setStage('ready')
    } catch (error) {
      setQrPayload(null)
      setRefreshAt(null)
      setSecondsLeft(0)
      setErrorMessage(error instanceof Error ? error.message : 'Could not generate your QR code')
      setStage('error')
    }
  }, [gym])

  useEffect(() => { void fetchToken() }, [fetchToken])

  useEffect(() => {
    if (stage !== 'ready' || refreshAt === null) return

    const updateCountdown = () => {
      const remaining = Math.max(0, Math.ceil((refreshAt - Date.now()) / 1000))
      setSecondsLeft(remaining)
      if (remaining === 0) void fetchToken(true)
    }

    timerRef.current = setInterval(updateCountdown, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [stage, refreshAt, fetchToken])

  const circumference = 2 * Math.PI * 44
  const progress = Math.min(1, secondsLeft / tokenLifetime)
  const strokeDash = circumference * (1 - progress)
  const initials = (gym?.name ?? 'GY').slice(0, 2).toUpperCase()

  return (
    <div className="fixed inset-0 bg-white flex flex-col items-center justify-start overflow-y-auto" style={{ color: '#171717' }}>
      <div className="mt-10 flex flex-col items-center gap-2">
        {gym?.logo_url ? (
          <img src={gym.logo_url} alt={gym.name} className="h-12 w-12 rounded-xl object-cover" />
        ) : (
          <div className="h-12 w-12 rounded-xl flex items-center justify-center text-white text-sm font-bold" style={{ background: gym?.brand_color ?? '#171717' }}>{initials}</div>
        )}
        <p className="text-sm font-medium text-gray-500">{gym?.name ?? 'Your Gym'}</p>
      </div>

      <div className="mt-6 text-center px-6">
        <p className="text-2xl font-semibold tracking-tight">{gymMember ? 'Your Entry QR' : 'Loading...'}</p>
      </div>

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
          {stage === 'loading' ? (
            <div className="w-[250px] h-[250px] flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
            </div>
          ) : qrPayload ? (
            <QRCodeSVG value={qrPayload} size={250} bgColor="#ffffff" fgColor="#171717" level="M" />
          ) : stage === 'error' ? (
            <div className="w-[250px] h-[250px] flex flex-col items-center justify-center px-5 text-center">
              <p className="text-sm text-red-600">{errorMessage ?? 'Could not generate your QR code'}</p>
              <button
                type="button"
                className="mt-4 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white"
                onClick={() => void fetchToken()}
              >
                Try again
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {(stage === 'ready' || stage === 'refreshing') && (
        <p className="mt-4 text-sm text-gray-400">Refreshes in {secondsLeft}s</p>
      )}

      <p className="mt-6 text-base font-medium text-gray-700 text-center px-8">Show this to the front desk</p>
      <div className="h-16" />
    </div>
  )
}
