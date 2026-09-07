import { Outlet } from 'react-router-dom'
import Header from './Header'
import BottomNav from './BottomNav'

export default function MemberLayout() {
  return <div className="min-h-dvh bg-background pb-24">
    <Header member />
    <main className="mx-auto max-w-lg p-5 sm:p-8">
      <Outlet />
    </main>
    <BottomNav />
  </div>
}
