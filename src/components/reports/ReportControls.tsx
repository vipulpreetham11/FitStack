import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { ReportPeriod } from '@/hooks/useReports'

export function ReportControls({ period, from, to, onPeriod, onFrom, onTo, onExport, exportLabel = 'Export Excel' }: {
  period: ReportPeriod; from: string; to: string
  onPeriod: (value: ReportPeriod) => void; onFrom: (value: string) => void; onTo: (value: string) => void
  onExport: () => void; exportLabel?: string
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="space-y-1 text-sm"><span className="text-muted-foreground">Period</span>
          <Select value={period} onValueChange={value => onPeriod(value as ReportPeriod)}><SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger><SelectContent>
            <SelectItem value="month">This Month</SelectItem><SelectItem value="last_month">Last Month</SelectItem><SelectItem value="quarter">This Quarter</SelectItem><SelectItem value="year">This Year</SelectItem><SelectItem value="custom">Custom Range</SelectItem>
          </SelectContent></Select>
        </label>
        {period === 'custom' && <><label className="space-y-1 text-sm"><span className="text-muted-foreground">From</span><Input type="date" value={from} onChange={event => onFrom(event.target.value)} /></label><label className="space-y-1 text-sm"><span className="text-muted-foreground">To</span><Input type="date" value={to} min={from} onChange={event => onTo(event.target.value)} /></label></>}
      </div>
      <Button variant="outline" onClick={onExport}>{exportLabel}</Button>
    </div>
  )
}
