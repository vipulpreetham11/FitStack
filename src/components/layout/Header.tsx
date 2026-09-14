import { useState } from 'react'
import { Menu, Bell, LogOut } from 'lucide-react'
import { useGym } from '@/hooks/useGym'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import ThemeToggle from './ThemeToggle'
import Sidebar from './Sidebar'
import { toast } from 'sonner'

export default function Header({ member = false }: { member?: boolean }) {
  const { gym, gyms, selectGym } = useGym()
  const { profile, previewRole, signOut } = useAuth()
  const [open, setOpen] = useState(false)

  const safeLogo = gym?.logo_url && /^https:\/\//i.test(gym.logo_url) ? gym.logo_url : null
  const initials = (profile?.full_name ?? 'U').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  const handleSignOut = async () => {
    try {
      await signOut()
      window.location.href = '/login'
    } catch {
      toast.error('Sign out failed. Please retry.')
    }
  }

  return <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-4 border-b bg-background px-5 sm:px-8">
    <div className="flex items-center gap-3">
      {/* Hamburger — admin mobile only */}
      {!member && <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger render={<Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation" />}>
          <Menu size={20} />
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <Sidebar onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>}

      {/* Gym identity */}
      {member
        ? <div className="flex items-center gap-2">
            {safeLogo && <img src={safeLogo} alt="" className="h-7 w-7 rounded object-contain" referrerPolicy="no-referrer" />}
            <p className="text-sm font-semibold" style={{ color: 'var(--brand-primary)' }}>{gym?.name ?? 'FitStack'}</p>
          </div>
        : <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--brand-primary)' }}>{gym?.name ?? 'FitStack'}</p>
            <p className="mt-0.5 text-xs capitalize text-muted-foreground">{previewRole ? 'Scaffold preview · ' : ''}{gym?.role ?? 'Platform workspace'}</p>
          </div>
      }

      {/* Multi-gym switcher */}
      {gyms.length > 1 && <select aria-label="Choose gym" className="max-w-40 rounded border bg-background p-2 text-sm" value={gym?.gym_id} onChange={e => selectGym(e.target.value)}>
        {gyms.map(g => <option value={g.gym_id} key={g.gym_id}>{g.name}</option>)}
      </select>}
    </div>

    {/* Right actions */}
    <div className="flex items-center gap-1">
      <ThemeToggle />
      {!member && <Button variant="ghost" size="icon" aria-label="Notifications (coming soon)" disabled>
        <Bell size={18} />
      </Button>}

      {/* User avatar dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="rounded-full" aria-label="Account menu" />}>
          <span className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-[var(--brand-on-primary)]" style={{ background: 'var(--brand-primary)' }}>
            {initials}
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <div className="px-2 py-1.5">
            <p className="text-sm font-medium">{profile?.full_name ?? 'User'}</p>
            <p className="text-xs text-muted-foreground">{profile?.email ?? gym?.role ?? ''}</p>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => void handleSignOut()}>
            <LogOut size={16} />{previewRole ? 'Exit preview' : 'Sign out'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </header>
}
