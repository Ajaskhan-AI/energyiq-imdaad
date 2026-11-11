import type { ReactNode } from 'react'
import { Card as ShadcnCard, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/shadcn/card'
import { cn } from '@/lib/utils'

interface Props {
  title?: ReactNode
  /** Small text under the title. */
  subtitle?: ReactNode
  actions?: ReactNode
  className?: string
  /** Remove inner padding (e.g. for full-width tables). */
  flush?: boolean
  children: ReactNode
}

/** Panel with an optional title bar, built on the shadcn Card. */
export function Card({ title, subtitle, actions, className, flush = false, children }: Props) {
  const hasHeader = !!(title || actions)
  return (
    <ShadcnCard className={cn('gap-0 overflow-hidden py-0', className)}>
      {hasHeader && (
        <CardHeader className="border-b border-navy-100/80 px-5 py-4 [.border-b]:pb-4">
          {title && <CardTitle className="text-base font-semibold text-navy-900">{title}</CardTitle>}
          {subtitle && <CardDescription className="text-navy-500">{subtitle}</CardDescription>}
          {actions && <CardAction className="row-span-2 flex flex-wrap items-center gap-2 self-center">{actions}</CardAction>}
        </CardHeader>
      )}
      <CardContent className={flush ? 'px-0' : 'p-5'}>{children}</CardContent>
    </ShadcnCard>
  )
}
