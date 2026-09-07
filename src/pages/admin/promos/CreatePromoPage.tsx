import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { PromoForm, promoValuesToInput, type PromoFormValues } from '@/components/promos/PromoForm'
import { Skeleton } from '@/components/ui/skeleton'
import { usePromos, type PromoCode } from '@/hooks/usePromos'

export default function CreatePromoPage() {
  const { promoId } = useParams<{ promoId: string }>()
  const navigate = useNavigate()
  const { createPromo, updatePromo, getPromo } = usePromos()
  const [promo, setPromo] = useState<PromoCode | null>(null)
  const [loading, setLoading] = useState(Boolean(promoId))
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!promoId) return
    let alive = true
    getPromo(promoId).then(value => { if (alive) setPromo(value) }).catch(cause => {
      if (alive) setError(cause instanceof Error ? cause.message : 'Could not load promo code')
    }).finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [getPromo, promoId])

  async function submit(values: PromoFormValues) {
    setSubmitting(true)
    try {
      const input = promoValuesToInput(values)
      if (promoId) { delete input.is_active; await updatePromo(promoId, input) }
      else await createPromo(input)
      toast.success(promoId ? 'Promo code updated' : 'Promo code created')
      navigate('/admin/promos')
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Could not save promo code')
    } finally { setSubmitting(false) }
  }

  if (loading) return <div className="space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-[560px]" /></div>
  if (error) return <div role="alert" className="rounded-lg border border-destructive/30 p-6 text-destructive">{error}</div>
  return <PromoForm key={promo?.id ?? 'new'} promo={promo ?? undefined} submitting={submitting} onSubmit={submit} />
}
