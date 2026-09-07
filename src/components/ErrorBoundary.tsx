import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'

type State = { error: Error | null }

export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }
  static getDerivedStateFromError(error: Error): State { return { error } }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('FitStack rendering error', error, info.componentStack) }
  render() {
    if (!this.state.error) return this.props.children
    return <main className="grid min-h-dvh place-items-center bg-background p-6"><div className="max-w-md space-y-4 text-center"><div className="mx-auto grid size-14 place-items-center rounded-full bg-destructive/10 text-2xl" aria-hidden>!</div><h1 className="text-2xl font-semibold">Something went wrong</h1><p className="text-muted-foreground">Your data is safe. Reload the workspace to try again.</p><Button onClick={() => window.location.reload()}>Reload FitStack</Button></div></main>
  }
}
