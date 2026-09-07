import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, UserPlus, ScanLine, X } from 'lucide-react'
import { useGym } from '@/hooks/useGym'
import { Button } from '@/components/ui/button'

const actions = [
  { label: 'New Member', icon: UserPlus, to: '/admin/members/new', permission: 'members.create' },
  { label: 'Record Attendance', icon: ScanLine, to: '/admin/attendance/scanner', permission: 'attendance.scan' },
] as const

export default function QuickCreate() {
  const { hasPermission } = useGym()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  const visible = actions.filter(a => hasPermission(a.permission))
  if (visible.length === 0) return null

  return <div className="fixed bottom-6 right-6 z-30">
    {/* Speed-dial actions */}
    {open && <div className="mb-3 flex flex-col items-end gap-2">
      {visible.map(action => (
        <button key={action.to} onClick={() => { setOpen(false); navigate(action.to) }}
          className="flex items-center gap-2 rounded-full border bg-background px-4 py-2.5 text-sm font-medium shadow-lg transition-colors hover:bg-muted">
          <action.icon size={16} />{action.label}
        </button>
      ))}
    </div>}

    {/* FAB */}
    <Button onClick={() => setOpen(o => !o)} size="icon"
      className="h-14 w-14 rounded-full shadow-lg"
      style={{ background: 'var(--brand-primary)', color: 'var(--brand-on-primary)' }}
      aria-label={open ? 'Close quick actions' : 'Quick actions'}>
      {open ? <X size={22} /> : <Plus size={22} />}
    </Button>
  </div>
}
