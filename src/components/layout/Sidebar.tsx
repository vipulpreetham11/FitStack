import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Users, CreditCard, ScanLine, FileText, Tag, BarChart3, CalendarOff, Settings, Dumbbell, Layers } from 'lucide-react'
import { hasPermission } from '@/lib/constants'
import { useGym } from '@/hooks/useGym'

const items = [
  ['/admin', 'Dashboard', LayoutDashboard, 'members.view'],
  ['/admin/members', 'Members', Users, 'members.view'],
  ['/admin/memberships', 'Memberships', Layers, 'memberships.view'],
  ['/admin/payments', 'Payments', CreditCard, 'payments.view'],
  ['/admin/attendance', 'Attendance', ScanLine, 'attendance.scan'],
  ['/admin/invoices', 'Invoices', FileText, 'invoices.view'],
  ['/admin/promos', 'Promo Codes', Tag, 'promos.manage'],
  ['/admin/reports/revenue', 'Reports', BarChart3, 'reports.view'],
  ['/admin/settings/holidays', 'Holidays', CalendarOff, 'holidays.manage'],
  ['/admin/settings', 'Settings', Settings, 'settings.manage'],
] as const

export default function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { gym, isSuperAdmin } = useGym()
  const safeLogo = gym?.logo_url && /^https:\/\//i.test(gym.logo_url) ? gym.logo_url : null

  return <div className="flex h-full flex-col">
    {/* Gym branding header */}
    <div className="flex items-center gap-3 border-b px-5 py-5">
      {safeLogo
        ? <img src={safeLogo} alt={(gym?.name ?? 'Gym') + ' logo'} className="h-10 w-10 shrink-0 rounded-xl object-contain" referrerPolicy="no-referrer" />
        : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[var(--brand-on-primary)]" style={{ background: 'var(--brand-primary)' }}><Dumbbell size={20} /></span>
      }
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold" style={{ color: 'var(--brand-primary)' }}>{gym?.name ?? 'FitStack'}</p>
        <p className="text-xs text-muted-foreground">GYM WORKSPACE</p>
      </div>
    </div>

    {/* Navigation */}
    <div className="flex-1 overflow-y-auto px-3 py-4">
      <p className="mb-3 px-3 text-[11px] font-semibold tracking-[.16em] text-muted-foreground">WORKSPACE</p>
      <nav className="grid gap-1" aria-label="Main navigation">
        {items.filter(i => hasPermission(gym?.role ?? null, i[3], isSuperAdmin)).map(([to, label, Icon]) =>
          <NavLink key={to} to={to} end={to === '/admin'} onClick={onNavigate}
            className={({ isActive }) =>
              'flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm transition-colors ' +
              (isActive ? 'font-medium' : 'text-muted-foreground hover:bg-muted hover:text-foreground')
            }
            style={({ isActive }) => isActive ? { background: 'var(--brand-primary)', color: 'var(--brand-on-primary)' } : undefined}
          >
            <Icon size={18} />{label}
          </NavLink>
        )}
      </nav>
    </div>

    {/* Footer card */}
    <div className="border-t p-4">
      <div className="rounded-xl border p-4 text-sm">
        <p className="font-medium">Built for your everyday.</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">One home for your gym and its people.</p>
      </div>
    </div>
  </div>
}
