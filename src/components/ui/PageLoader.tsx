import clsx from 'clsx'
import { LoaderCircle } from 'lucide-react'

/** Spinner shown for a moment while a page's code is downloaded. */
export function PageLoader({ fullScreen = false }: { fullScreen?: boolean }) {
  return (
    <div className={clsx('flex items-center justify-center text-navy-400', fullScreen ? 'min-h-screen bg-white' : 'py-24')} role="status">
      <LoaderCircle className="size-8 animate-spin" aria-hidden />
      <span className="sr-only">Loading…</span>
    </div>
  )
}
