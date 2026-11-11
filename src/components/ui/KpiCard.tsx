import { ArrowUpRight, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { cn } from '@/lib/utils'
import type { Tone } from './Badge'

const ICON_TONES: Record<Tone, string> = {
  ok: 'bg-green-50 text-green-700 ring-green-200',
  warn: 'bg-amber-50 text-amber-700 ring-amber-200',
  alert: 'bg-red-50 text-red-700 ring-red-200',
  info: 'bg-teal-50 text-teal-700 ring-teal-200',
  neutral: 'bg-navy-50 text-navy-600 ring-navy-200',
}

/** Thin coloured line on top of the card, so the status reads from across the room. */
const ACCENT: Record<Tone, string> = {
  ok: 'before:bg-green-500',
  warn: 'before:bg-amber-500',
  alert: 'before:bg-red-500',
  info: 'before:bg-teal-600',
  neutral: 'before:bg-navy-200',
}

interface Props {
  label: string
  value: ReactNode
  sub?: ReactNode
  icon: LucideIcon
  tone?: Tone
  /** Makes the whole card a link (e.g. Overview KPI → its module). */
  to?: string
}

/** Big-number tile, readable on a projector (shadcn card styling). */
export function KpiCard({ label, value, sub, icon: Icon, tone = 'neutral', to }: Props) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-navy-500">{label}</p>
        <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset', ICON_TONES[tone])}>
          <Icon className="size-[18px]" aria-hidden />
        </span>
      </div>
      <p className="mt-2 text-3xl font-bold tracking-tight text-navy-900 tabular-nums">{value}</p>
      {sub && <p className="mt-1 text-sm text-navy-500">{sub}</p>}
    </>
  )
  const className = cn(
    'relative block overflow-hidden rounded-xl border bg-card p-5 shadow-sm',
    'before:absolute before:inset-x-0 before:top-0 before:h-1',
    ACCENT[tone],
  )
  return to ? (
    <Link to={to} className={cn(className, 'group transition hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-md focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none')}>
      {body}
      <ArrowUpRight className="absolute right-3 bottom-3 size-4 text-navy-300 opacity-0 transition group-hover:opacity-100" aria-hidden />
    </Link>
  ) : (
    <div className={className}>{body}</div>
  )
}
