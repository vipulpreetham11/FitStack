import { createContext, useEffect, useState, type ReactNode } from 'react'
import type { Theme } from '@/types'
export const ThemeContext = createContext<{ theme: Theme; toggleTheme: () => void } | null>(null)
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => { try { return localStorage.getItem('fitstack-theme') === 'dark' ? 'dark' : 'light' } catch { return 'light' } })
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    document.documentElement.style.colorScheme = theme
    try { localStorage.setItem('fitstack-theme', theme) } catch { /* Private browsing may disable storage. */ }
  }, [theme])
  return <ThemeContext.Provider value={{ theme, toggleTheme: () => setTheme(t => t === 'light' ? 'dark' : 'light') }}>{children}</ThemeContext.Provider>
}
