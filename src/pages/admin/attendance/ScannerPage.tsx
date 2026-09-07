import { useCallback, useEffect, useRef, useState } from 'react'
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode'
import { CheckCircle2, XCircle, UserCircle } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useGym } from '@/hooks/useGym'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatDate } from '@/lib/format'

type ScanResult = {
  allowed: boolean
  reason?: string
  member?: {
    id: string
    name: string
    plan_name: string
    membership_status: string
    end_date: string | null
  }
  devMode?: boolean
}

type ScanStage = 'scanning' | 'success' | 'denied' | 'override'

export default function ScannerPage() {
  const { gym, hasPermission } = useGym()
  const { user } = useAuth()
  const [stage, setStage] = useState<ScanStage>('scanning')
  const [result, setResult] = useState<ScanResult | null>(null)
  const [overrideReason, setOverrideReason] = useState('')
  const [overriding, setOverriding] = useState(false)
  const [manualCode, setManualCode] = useState('')
  const [showManual, setShowManual] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const pausedRef = useRef(false)
  const canOverride = hasPermission('members.create') // owner / admin

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop() } catch { /* ignore */ }
      scannerRef.current = null
    }
  }, [])

  const processToken = useCallback(async (token: string) => {
    if (pausedRef.current || !gym || !supabase) return
    pausedRef.current = true
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(100)

    try {
      const { data, error } = await supabase.functions.invoke('verify-qr-checkin', {
        body: { token, device_id: user?.id ?? 'unknown' },
      })
      if (error) { toast.error('Scan error. Try again.'); pausedRef.current = false; return }
      const res = data as ScanResult
      setResult(res)
      setStage(res.allowed ? 'success' : 'denied')
      if (res.allowed) {
        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([100, 50, 100])
        setTimeout(() => { setStage('scanning'); setResult(null); pausedRef.current = false }, 3000)
      }
    } catch {
      toast.error('Scan failed. Check network connection.')
      pausedRef.current = false
    }
  }, [gym, user])

  const startScanner = useCallback(async () => {
    if (scannerRef.current) return
    setCameraError(null)
    const qr = new Html5Qrcode('qr-reader', { verbose: false, formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE] })
    scannerRef.current = qr
    try {
      await qr.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
        (decodedText) => { void processToken(decodedText) },
        undefined,
      )
    } catch (err) {
      scannerRef.current = null
      setCameraError(err instanceof Error ? err.message : 'Camera permission denied')
    }
  }, [processToken])

  useEffect(() => {
    if (stage === 'scanning') {
      void startScanner()
    } else if (stage === 'success') {
      void stopScanner()
    }
    return () => { void stopScanner() }
  }, [stage, startScanner, stopScanner])

  const handleDismiss = () => { setStage('scanning'); setResult(null); pausedRef.current = false; void startScanner() }
  const handleOverrideConfirm = async () => {
    if (!overrideReason.trim() || !result?.member || !gym || !supabase) return
    setOverriding(true)
    try {
      const { error } = await (supabase as any).from('attendance').insert({
        gym_id: gym.gym_id, member_id: result.member.id, method: 'qr',
        
      })
      if (error) throw error
      toast.success('Override recorded. Member access granted.')
      setOverrideReason(''); setStage('scanning'); setResult(null); pausedRef.current = false; void startScanner()
    } catch (err: any) {
      toast.error(err.message ?? 'Override failed')
    } finally { setOverriding(false) }
  }

  const handleManualLookup = async () => {
    if (!manualCode.trim() || !gym || !supabase) return
    const { data } = await (supabase as any).from('gym_members')
      .select('id, profiles(full_name)')
      .eq('gym_id', gym.gym_id)
      .ilike('member_code', manualCode.trim())
      .maybeSingle()
    if (!data) { toast.error('Member code not found'); return }
    const devToken = `${gym.gym_id}:${data.id}:${Math.floor(Date.now() / 1000)}:dev-mode`
    setShowManual(false); setManualCode('')
    await processToken(devToken)
  }

  const member = result?.member

  return (
    <div className="fixed inset-0 bg-gray-950 flex flex-col" style={{ zIndex: 50 }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900">
        <h1 className="text-white font-semibold">QR Scanner</h1>
        <button onClick={() => setShowManual(s => !s)} className="text-sm text-gray-400 hover:text-white">Enter code</button>
      </div>

      {/* Camera area */}
      <div className="relative flex-1 flex flex-col items-center justify-center">
        {/* Semi-transparent overlay */}
        <div className="absolute inset-0 bg-black/60 pointer-events-none" style={{ maskImage: 'radial-gradient(270px 270px at center, transparent 130px, black 131px)' }} />
        <div id="qr-reader" className="w-full max-w-lg" />
        {cameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white text-center px-8">
            <XCircle className="h-12 w-12 text-red-400 mb-4" />
            <p className="text-lg font-medium">Camera unavailable</p>
            <p className="text-sm text-gray-400 mt-2">{cameraError}</p>
            <p className="text-sm text-gray-400 mt-1">Use "Enter code" to record attendance manually.</p>
          </div>
        )}
        {/* Scanning frame overlay */}
        {stage === 'scanning' && !cameraError && (
          <div className="absolute pointer-events-none" style={{ width: 260, height: 260, border: '2px solid rgba(255,255,255,0.6)', borderRadius: 12 }} />
        )}
      </div>

      {/* Manual code input */}
      {showManual && (
        <div className="bg-gray-900 border-t border-gray-800 p-4 flex gap-2">
          <Input
            placeholder="Member code (e.g. GYM-001)"
            value={manualCode}
            onChange={e => setManualCode(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && void handleManualLookup()}
            className="bg-gray-800 text-white border-gray-700 focus:border-gray-500"
          />
          <Button onClick={() => void handleManualLookup()}>Look up</Button>
        </div>
      )}

      {/* Success panel */}
      {stage === 'success' && member && (
        <div className="absolute inset-0 bg-emerald-600 flex flex-col items-center justify-center text-white px-6 text-center">
          <CheckCircle2 className="h-16 w-16 mb-4" />
          <h2 className="text-3xl font-bold mb-2">CHECK-IN SUCCESSFUL</h2>
          <div className="mt-4 bg-white/10 rounded-2xl p-6 w-full max-w-sm">
            <UserCircle className="h-16 w-16 mx-auto mb-3 text-white/70" />
            <p className="text-2xl font-semibold">{member.name}</p>
            <p className="text-emerald-100 mt-1">{member.plan_name}</p>
            {member.end_date && <p className="text-emerald-100 text-sm mt-1">Expires: {formatDate(member.end_date)}</p>}
            {result.devMode && <p className="mt-3 text-amber-200 text-xs">Dev mode check-in</p>}
          </div>
          <p className="mt-6 text-emerald-100 text-sm">Resuming in 3 seconds…</p>
        </div>
      )}

      {/* Denied panel */}
      {(stage === 'denied' || stage === 'override') && member && (
        <div className="absolute inset-0 bg-red-700 flex flex-col items-center justify-center text-white px-6 text-center">
          <XCircle className="h-16 w-16 mb-4" />
          <h2 className="text-3xl font-bold mb-2">ACCESS DENIED</h2>
          <div className="mt-4 bg-white/10 rounded-2xl p-6 w-full max-w-sm">
            <UserCircle className="h-16 w-16 mx-auto mb-3 text-white/70" />
            <p className="text-2xl font-semibold">{member.name}</p>
            <p className="text-red-100 mt-2">{result?.reason}</p>
            {member.end_date && <p className="text-red-100 text-sm mt-1">Expired: {formatDate(member.end_date)}</p>}
          </div>
          {stage === 'override' && (
            <div className="mt-4 w-full max-w-sm space-y-3">
              <Input
                placeholder="Override reason (required)"
                value={overrideReason}
                onChange={e => setOverrideReason(e.target.value)}
                className="bg-white/10 text-white border-white/30 placeholder:text-white/50"
              />
              <Button variant="secondary" className="w-full" onClick={() => void handleOverrideConfirm()} disabled={overriding || !overrideReason.trim()}>
                {overriding ? 'Recording...' : 'Confirm Override'}
              </Button>
            </div>
          )}
          <div className="flex gap-3 mt-4">
            {canOverride && stage !== 'override' && (
              <Button variant="secondary" onClick={() => setStage('override')}>Override</Button>
            )}
            <Button variant="outline" className="text-white border-white/40 hover:bg-white/10" onClick={handleDismiss}>Dismiss</Button>
          </div>
        </div>
      )}
    </div>
  )
}
