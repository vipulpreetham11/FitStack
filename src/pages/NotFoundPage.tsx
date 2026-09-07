import { Link } from 'react-router-dom'
import { ArrowLeft, Dumbbell } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function NotFoundPage() {
  return <main className="grid min-h-dvh place-items-center bg-muted/20 p-6"><div className="max-w-md text-center"><span className="mx-auto grid size-14 place-items-center rounded-xl bg-foreground text-background"><Dumbbell /></span><p className="mt-6 text-sm font-semibold text-muted-foreground">404</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">This page took a rest day</h1><p className="mt-3 text-muted-foreground">The address may be outdated or the page may have moved.</p><Button className="mt-6" nativeButton={false} render={<Link to="/"><ArrowLeft /> Return to workspace</Link>} /></div></main>
}
