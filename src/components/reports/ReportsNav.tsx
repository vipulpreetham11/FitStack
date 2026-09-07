import { NavLink } from 'react-router-dom'
import { cn } from 'cn'

const links = [
  ['/admin/reports/revenue', 'Revenue'],
  ['/admin/reports/memberships', 'Memberships'],
  ['/admin/reports/attendance', 'Attendance'],
  ['/admin/reports/payments', 'Payments'],
] as const

export default function ReportsNav() {
  return (
    <nav aria-label="Report types" className="flex max-w-full gap-1 overflow-x-auto rounded-lg border bg-muted/40 p-1">
      {links.map(([to, label]) => (
        <NavLink key={to} to={to} className={({ isActive }) => cn('min-h-10 shrink-0 rounded-md px-4 py-2 text-sm font-medium transition-colors', isActive ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
