import { useCallback, useEffect, useRef, useState } from 'react'
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode'
import { CheckCircle2, XCircle, UserCircle } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useGym } from '@/hooks/useGym'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type ScanResult = {
  result: 'allowed' | 'denied'
  reason?: string
  member_name?: string
  memberId: string | null
}

type ScanStage = 'scanning' | 'success' | 'denied' | 'override'

function memberIdFromQr(qrData: string): string | null {
  const parts = qrData.split(':')
  return parts.length === 4 && parts[0] === 'fitstack' ? parts[2] : null
}

export default function ScannerPage() {
  const { gym, hasPermission } = useGym()
  const [stage, setStage] = useState<ScanStage>('scanning')
  const [result, setResult] = useState<ScanResult | null>(null)
  const [overrideReason, setOverrideReason] = useState('')
  const [overriding, setOverriding] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const pausedRef = useRef(false)
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const canOverride = hasPermission('attendance.override')

  const stopScanner = useCallback(async () => {
    if (!scannerRef.current) return
    try { await scannerRef.current.stop() } catch { /* scanner may already be stopped */ }
    scannerRef.current = null
  }, [])

  const processQrData = useCallback(async (scannedQrString: string) => {
    if (pausedRef.current || !gym || !supabase) return
    pausedRef.current = true
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(100)

    try {
      const { data, error } = await supabase.functions.invoke('verify-qr-checkin', {
        body: {
          qr_data: scannedQrString,
          gym_id: gym.gym_id,
          device_id: null,
        },
      })

      if (error) throw error

      const response = data as Partial<Omit<ScanResult, 'memberId'>> | null
      if (!response || (response.result !== 'allowed' && response.result !== 'denied')) {
        throw new Error('The scanner service returned an invalid response')
      }

      const scanResult: ScanResult = {
        result: response.result,
        reason: response.reason,
        member_name: response.member_name,
        memberId: memberIdFromQr(scannedQrString),
      }

      setResult(scanResult)
      setStage(scanResult.result === 'allowed' ? 'success' : 'denied')

      if (scanResult.result === 'allowed') {
        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([100, 50, 100])
        resumeTimerRef.current = setTimeout(() => {
          setStage('scanning')
          setResult(null)
          pausedRef.current = false
        }, 3000)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Scan failed. Check network connection.')
      pausedRef.current = false
    }
  }, [gym])

  const startScanner = useCallback(async () => {
    if (scannerRef.current) return
    setCameraError(null)
    const qr = new Html5Qrcode('qr-reader', {
      verbose: false,
      formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
    })
    scannerRef.current = qr

    try {
      await qr.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1 },
        decodedText => { void processQrData(decodedText) },
        undefined,
      )
    } catch (error) {
      scannerRef.current = null
      setCameraError(error instanceof Error ? error.message : 'Camera permission denied')
    }
  }, [processQrData])

  useEffect(() => {
    if (stage === 'scanning') void startScanner()
    else void stopScanner()
  }, [stage, startScanner, stopScanner])

  useEffect(() => () => {
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current)
    void stopScanner()
  }, [stopScanner])

  const handleDismiss = () => {
    setStage('scanning')
    setResult(null)
    pausedRef.current = false
  }

  const handleOverrideConfirm = async () => {
    if (!overrideReason.trim() || !result?.memberId || !gym || !supabase) return
    setOverriding(true)

    try {
      const { error } = await supabase.from('attendance').insert({
        gym_id: gym.gym_id,
        member_id: result.memberId,
        method: 'qr',
      })
      if (error) throw error
      toast.success('Override recorded. Member access granted.')
      setOverrideReason('')
      setStage('scanning')
      setResult(null)
      pausedRef.current = false
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Override failed')
    } finally {
      setOverriding(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-gray-950 flex flex-col" style={{ zIndex: 50 }}>
      <div className="flex items-center px-4 py-3 bg-gray-900">
        <h1 className="text-white font-semibold">QR Scanner</h1>
      </div>

      <div className="relative flex-1 flex flex-col items-center justify-center">
        <div className="absolute inset-0 bg-black/60 pointer-events-none" style={{ maskImage: 'radial-gradient(270px 270px at center, transparent 130px, black 131px)' }} />
        <div id="qr-reader" className="w-full max-w-lg" />
        {cameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white text-center px-8">
            <XCircle className="h-12 w-12 text-red-400 mb-4" />
            <p className="text-lg font-medium">Camera unavailable</p>
            <p className="text-sm text-gray-400 mt-2">{cameraError}</p>
            <p className="text-sm text-gray-400 mt-1">Allow camera access and try again.</p>
          </div>
        )}
        {stage === 'scanning' && !cameraError && (
          <div className="absolute pointer-events-none" style={{ width: 260, height: 260, border: '2px solid rgba(255,255,255,0.6)', borderRadius: 12 }} />
        )}
      </div>

      {stage === 'success' && result && (
        <div className="absolute inset-0 bg-emerald-600 flex flex-col items-center justify-center text-white px-6 text-center">
          <CheckCircle2 className="h-16 w-16 mb-4" />
          <h2 className="text-3xl font-bold mb-2">CHECK-IN SUCCESSFUL</h2>
          <div className="mt-4 bg-white/10 rounded-2xl p-6 w-full max-w-sm">
            <UserCircle className="h-16 w-16 mx-auto mb-3 text-white/70" />
            <p className="text-2xl font-semibold">{result.member_name ?? 'Member'}</p>
          </div>
          <p className="mt-6 text-emerald-100 text-sm">Resuming in 3 seconds…</p>
        </div>
      )}

      {(stage === 'denied' || stage === 'override') && result && (
        <div className="absolute inset-0 bg-red-700 flex flex-col items-center justify-center text-white px-6 text-center">
          <XCircle className="h-16 w-16 mb-4" />
          <h2 className="text-3xl font-bold mb-2">ACCESS DENIED</h2>
          <div className="mt-4 bg-white/10 rounded-2xl p-6 w-full max-w-sm">
            <UserCircle className="h-16 w-16 mx-auto mb-3 text-white/70" />
            {result.member_name && <p className="text-2xl font-semibold">{result.member_name}</p>}
            <p className="text-red-100 mt-2">{result.reason ?? 'Access denied'}</p>
          </div>
          {stage === 'override' && (
            <div className="mt-4 w-full max-w-sm space-y-3">
              <Input
                placeholder="Override reason (required)"
                value={overrideReason}
                onChange={event => setOverrideReason(event.target.value)}
                className="bg-white/10 text-white border-white/30 placeholder:text-white/50"
              />
              <Button variant="secondary" className="w-full" onClick={() => void handleOverrideConfirm()} disabled={overriding || !overrideReason.trim()}>
                {overriding ? 'Recording...' : 'Confirm Override'}
              </Button>
            </div>
          )}
          <div className="flex gap-3 mt-4">
            {canOverride && result.memberId && stage !== 'override' && (
              <Button variant="secondary" onClick={() => setStage('override')}>Override</Button>
            )}
            <Button variant="outline" className="text-white border-white/40 hover:bg-white/10" onClick={handleDismiss}>Dismiss</Button>
          </div>
        </div>
      )}
    </div>
  )
}
