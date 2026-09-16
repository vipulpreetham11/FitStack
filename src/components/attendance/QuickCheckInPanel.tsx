import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Search, UserRoundSearch } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useQuickCheckIn, type ManualCheckInResult, type QuickCheckInMember } from '@/hooks/useQuickCheckIn'

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || 'M'
}

function membershipFor(member: QuickCheckInMember) {
  return member.memberships.find(item => item.status === 'active')
    ?? member.memberships.find(item => item.status === 'frozen')
    ?? member.memberships[0]
    ?? null
}

const statusClasses: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  frozen: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
  scheduled: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  expired: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
}

export function QuickCheckInPanel({ onCheckedIn }: { onCheckedIn: () => void | Promise<void> }) {
  const { searchMembers, checkIn } = useQuickCheckIn()
  const [query, setQuery] = useState('')
  const [members, setMembers] = useState<QuickCheckInMember[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checkingId, setCheckingId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ memberId: string; value: ManualCheckInResult } | null>(null)
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const normalizedQuery = useMemo(() => query.trim(), [query])

  useEffect(() => {
    if (!normalizedQuery) {
      if (feedback?.value.result !== 'allowed') setMembers([])
      setLoading(false)
      setError(null)
      return
    }

    let active = true
    const timer = window.setTimeout(() => {
      setLoading(true)
      setError(null)
      searchMembers(normalizedQuery)
        .then(rows => { if (active) setMembers(rows) })
        .catch(cause => { if (active) { setMembers([]); setError(cause instanceof Error ? cause.message : 'Could not search members') } })
        .finally(() => { if (active) setLoading(false) })
    }, 300)

    return () => { active = false; window.clearTimeout(timer) }
  }, [feedback?.value.result, normalizedQuery, searchMembers])

  useEffect(() => () => { if (clearTimer.current) clearTimeout(clearTimer.current) }, [])

  async function handleCheckIn(memberId: string) {
    if (clearTimer.current) clearTimeout(clearTimer.current)
    setCheckingId(memberId)
    setFeedback(null)
    try {
      const value = await checkIn(memberId)
      setFeedback({ memberId, value })
      if (value.result === 'allowed') {
        setQuery('')
        await onCheckedIn()
        clearTimer.current = setTimeout(() => {
          setFeedback(null)
          setMembers([])
        }, 2000)
      }
    } catch (cause) {
      setFeedback({ memberId, value: { result: 'denied', reason: cause instanceof Error ? cause.message : 'Check-in failed' } })
    } finally {
      setCheckingId(null)
    }
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Quick Check-In</CardTitle>
        <CardDescription>Find a member by name or phone and check them in manually.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            value={query}
            onChange={event => { setQuery(event.target.value); setFeedback(null) }}
            placeholder="Search by name or phone..."
            className="pl-9"
            aria-label="Search members for check-in"
          />
        </div>

        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {loading && <div className="space-y-2">{[0, 1].map(item => <Skeleton key={item} className="h-20" />)}</div>}
        {!loading && normalizedQuery && members.length === 0 && !error && (
          <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
            <UserRoundSearch className="mx-auto mb-2 size-6" aria-hidden="true" />
            No matching members
          </div>
        )}

        {!loading && members.map(member => {
          const membership = membershipFor(member)
          const memberFeedback = feedback?.memberId === member.id ? feedback.value : null
          return (
            <div key={member.id} className="rounded-xl border p-3">
              <div className="flex items-center gap-3">
                <Avatar size="lg">
                  {member.profiles.avatar_url && <AvatarImage src={member.profiles.avatar_url} alt="" />}
                  <AvatarFallback>{initials(member.profiles.full_name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{member.profiles.full_name}</p>
                  <p className="truncate text-sm text-muted-foreground">{membership?.membership_plans?.name ?? 'No membership plan'}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Badge className={statusClasses[membership?.status ?? ''] ?? ''} variant={membership ? 'secondary' : 'outline'}>
                      {membership?.status ?? 'No membership'}
                    </Badge>
                    {member.profiles.phone && <span className="text-xs text-muted-foreground">{member.profiles.phone}</span>}
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => void handleCheckIn(member.id)}
                  disabled={checkingId !== null || memberFeedback?.result === 'allowed'}
                >
                  {checkingId === member.id ? 'Checking…' : memberFeedback?.result === 'allowed' ? <><Check aria-hidden="true" /> Checked in</> : 'Check In'}
                </Button>
              </div>
              {memberFeedback && (
                <p
                  role="status"
                  className={`mt-3 rounded-md px-3 py-2 text-sm ${memberFeedback.result === 'allowed' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'}`}
                >
                  {memberFeedback.result === 'allowed' ? 'Checked in ✓' : memberFeedback.reason ?? 'Check-in denied'}
                </p>
              )}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
