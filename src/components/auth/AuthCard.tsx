import type { CSSProperties, ReactNode } from 'react'
import { Dumbbell } from 'lucide-react'
import ThemeToggle from '@/components/layout/ThemeToggle'
export default function AuthCard({ title, description, children, style, logo, name = 'FitStack' }: { title:string; description?:string; children:ReactNode; style?:CSSProperties; logo?:string|null; name?:string }) {
 const safeLogo = logo && /^https:\/\//i.test(logo) ? logo : null
 return <main className="relative flex min-h-dvh items-center justify-center bg-background px-4 py-20" style={style}>
  <div className="absolute right-4 top-4"><ThemeToggle/></div>
  <section className="w-full max-w-md rounded-2xl border bg-card p-5 shadow-sm sm:p-8">
   <div className="mb-8 flex items-center justify-center gap-3 font-semibold">{safeLogo ? <img src={safeLogo} alt={name + ' logo'} className="h-12 w-12 object-contain" referrerPolicy="no-referrer"/> : <Dumbbell aria-hidden="true"/>}<span>{name}</span></div>
   <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
   {description && <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>}
   <div className="mt-6">{children}</div>
  </section>
 </main>
}
