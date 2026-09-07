import type { ElementType } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export default function ReportMetric({ label, value, icon: Icon, loading }: { label: string; value: string | number; icon: ElementType; loading: boolean }) {
  return <Card><CardContent className="pt-5"><div className="mb-2 flex items-center justify-between gap-2"><p className="text-sm text-muted-foreground">{label}</p><Icon className="size-4 text-muted-foreground" /></div>{loading ? <Skeleton className="h-8 w-24" /> : <p className="text-2xl font-semibold tracking-tight">{value}</p>}</CardContent></Card>
}
