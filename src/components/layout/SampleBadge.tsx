import { FlaskConical } from 'lucide-react'
import clsx from 'clsx'

/** Required on every screen: makes clear none of the numbers are real client data. */
export function SampleBadge({ className }: { className?: string }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800',
        className,
      )}
    >
      <FlaskConical className="size-3.5" aria-hidden />
      Sample data — for demonstration only
    </span>
  )
}
