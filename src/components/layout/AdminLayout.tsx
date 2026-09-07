import { Outlet } from 'react-router-dom'
import Header from './Header'
import Sidebar from './Sidebar'
import QuickCreate from './QuickCreate'
import { useGym } from '@/hooks/useGym'

export default function AdminLayout() {
  const { gym } = useGym()
  return <div className="min-h-dvh bg-background">
    <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:z-50 focus:bg-background focus:p-4">Skip to content</a>

    {/* Fixed sidebar — desktop only */}
    <aside className="fixed inset-y-0 left-0 hidden w-64 border-r bg-background lg:block">
      <Sidebar />
    </aside>

    {/* Main area offset by sidebar width on desktop */}
    <div className="lg:pl-64">
      <Header />
      {gym && !gym.is_active && <div role="status" className="border-b bg-muted p-3 text-center text-sm">Subscription inactive — this workspace is read-only.</div>}
      <main id="main" className="mx-auto max-w-7xl p-5 sm:p-8 lg:p-10">
        <Outlet />
      </main>
    </div>

    {/* Quick-create FAB */}
    <QuickCreate />
  </div>
}
