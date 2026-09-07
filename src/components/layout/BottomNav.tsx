import { NavLink } from 'react-router-dom'
import { Home, Dumbbell, QrCode, Receipt, User } from 'lucide-react'

const items = [
  ['/member', 'Home', Home],
  ['/member/plans', 'Plans', Dumbbell],
  ['/member/qr', 'QR', QrCode],
  ['/member/payments', 'Payments', Receipt],
  ['/member/profile', 'Profile', User],
] as const

export default function BottomNav() {
  return <nav aria-label="Member navigation" className="fixed inset-x-0 bottom-0 z-30 flex items-end justify-around border-t bg-background px-2 pb-[max(.5rem,env(safe-area-inset-bottom))]">
    {items.map(([to, label, Icon]) => {
      const isQR = to === '/member/qr'
      return <NavLink key={to} to={to} end={to === '/member'}
        className={({ isActive }) =>
          'flex flex-col items-center gap-1 rounded-lg p-2 text-[11px] transition-colors ' +
          (isQR ? 'relative -mt-3 min-w-16 ' : 'min-h-16 min-w-14 ') +
          (isActive ? 'font-semibold' : 'text-muted-foreground')
        }
        style={({ isActive }) => isActive ? { color: 'var(--brand-primary)' } : undefined}
      >
        {isQR
          ? <span className="mb-0.5 flex h-12 w-12 items-center justify-center rounded-full shadow-md text-[var(--brand-on-primary)]" style={{ background: 'var(--brand-primary)' }}><Icon size={22} /></span>
          : <Icon size={20} />
        }
        <span>{label}</span>
      </NavLink>
    })}
  </nav>
}
