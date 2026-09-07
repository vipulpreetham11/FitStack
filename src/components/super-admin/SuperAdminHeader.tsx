import { Link, NavLink } from 'react-router-dom'
import { Dumbbell, Moon, Plus, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/hooks/useTheme'

export default function SuperAdminHeader() {
  const { theme, toggleTheme } = useTheme()
  return <header className="border-b bg-background"><div className="mx-auto flex min-h-16 max-w-7xl items-center gap-4 px-5 sm:px-8"><Link to="/super-admin" className="flex items-center gap-2 font-semibold"><span className="grid size-9 place-items-center rounded-lg bg-foreground text-background"><Dumbbell className="size-5" /></span>FitStack</Link><nav aria-label="Super admin" className="ml-auto flex items-center gap-2"><NavLink to="/super-admin" end className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground">Gyms</NavLink><Button nativeButton={false} size="sm" render={<Link to="/super-admin/gyms/new"><Plus /> New gym</Link>} /><Button variant="ghost" size="icon" aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} onClick={toggleTheme}>{theme === 'dark' ? <Sun /> : <Moon />}</Button></nav></div></header>
}
