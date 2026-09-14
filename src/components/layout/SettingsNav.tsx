import { NavLink, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'

export default function SettingsNav() {
  const location = useLocation()
  const currentPath = location.pathname

  const links = [
    { name: 'Profile', href: '/admin/settings' },
    { name: 'Business Hours', href: '/admin/settings/hours' },
    { name: 'Holidays', href: '/admin/settings/holidays' },
    { name: 'Team', href: '/admin/settings/team' },
    { name: 'Payments', href: '/admin/settings/payments' },
    { name: 'Invoices', href: '/admin/settings/invoices' },
  ]

  const isCurrent = (href: string) => {
    if (href === '/admin/settings') {
      return currentPath === '/admin/settings' || currentPath === '/admin/settings/profile'
    }
    return currentPath === href
  }

  return (
    <div className="mb-6 overflow-x-auto pb-2">
      <nav className="flex space-x-1" aria-label="Settings navigation">
        {links.map((link) => {
          const active = isCurrent(link.href)
          return (
            <NavLink
              key={link.name}
              to={link.href}
              className={cn(
                'whitespace-nowrap px-4 py-2 text-sm font-medium rounded-md transition-colors',
                active
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              )}
            >
              {link.name}
            </NavLink>
          )
        })}
      </nav>
    </div>
  )
}
