import { cn } from '@/lib/utils'

/** Kuroshio AI logo symbol (files in /public). White version for dark backgrounds. */
export function KuroshioLogo({ white = false, className }: { white?: boolean; className?: string }) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}${white ? 'kuroshio-logo-white.png' : 'kuroshio-logo.png'}`}
      alt="Kuroshio AI"
      className={cn('h-8 w-auto shrink-0 select-none', className)}
      draggable={false}
    />
  )
}

/**
 * Logo + product name. The app is Kuroshio-branded; the client appears only as
 * "Prepared for Imdaad" (no Imdaad logo or look-alike branding).
 */
export function BrandMark({ dark = false, showPreparedFor = true, large = false }: { dark?: boolean; showPreparedFor?: boolean; large?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <KuroshioLogo white={dark} className={large ? 'h-12' : undefined} />
      <div className="flex flex-wrap items-baseline gap-x-2 leading-tight">
        <span className={cn('text-lg font-bold tracking-tight', dark ? 'text-white' : 'text-navy-900')}>
          Kuroshio <span className={dark ? 'text-teal-300' : 'text-teal-600'}>AI</span>
        </span>
        <span className={cn('text-sm font-semibold', dark ? 'text-navy-200' : 'text-navy-500')}>EnergyIQ</span>
        {showPreparedFor && <span className={cn('hidden text-xs sm:inline', dark ? 'text-navy-300' : 'text-navy-400')}>· Prepared for Imdaad</span>}
      </div>
    </div>
  )
}
