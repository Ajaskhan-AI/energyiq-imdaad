import type { ReactNode } from 'react'
import { Badge as ShadcnBadge } from '@/components/shadcn/badge'
import { cn } from '@/lib/utils'

/** ok = green, warn = amber, alert = red (status colours). info = brand blue, neutral = grey-blue. */
export type Tone = 'ok' | 'warn' | 'alert' | 'info' | 'neutral'

const TONES: Record<Tone, string> = {
  ok: 'border-green-200 bg-green-50 text-green-800',
  warn: 'border-amber-200 bg-amber-50 text-amber-800',
  alert: 'border-red-200 bg-red-50 text-red-700',
  info: 'border-teal-200 bg-teal-50 text-teal-800',
  neutral: 'border-navy-200 bg-navy-50 text-navy-700',
}

/** Status pill, built on the shadcn Badge. */
export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <ShadcnBadge variant="outline" className={cn('gap-1 px-2.5 font-semibold [&>svg]:size-3', TONES[tone], className)}>
      {children}
    </ShadcnBadge>
  )
}
