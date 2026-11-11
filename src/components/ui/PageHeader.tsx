import type { ReactNode } from 'react'

interface Props {
  title: string
  description?: string
  /** Buttons/filters shown on the right of the title. */
  actions?: ReactNode
}

export function PageHeader({ title, description, actions }: Props) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-navy-950 sm:text-3xl">{title}</h1>
        {description && <p className="mt-1.5 max-w-3xl text-[15px] leading-relaxed text-navy-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
