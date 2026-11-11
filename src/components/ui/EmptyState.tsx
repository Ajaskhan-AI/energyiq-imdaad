import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export function EmptyState({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children?: ReactNode }) {
  return (
    <div className="px-6 py-10 text-center">
      <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-teal-50 text-teal-600 ring-1 ring-teal-100">
        <Icon className="size-6" aria-hidden />
      </span>
      <p className="mt-3 font-semibold text-navy-800">{title}</p>
      {children && <div className="mt-1 text-sm text-navy-500">{children}</div>}
    </div>
  )
}
