import clsx from 'clsx'

/**
 * Product name. The app is Kuroshio-branded; the client appears only as
 * "Prepared for Imdaad" (no Imdaad logo or look-alike branding).
 */
export function BrandMark({ dark = false, showPreparedFor = true }: { dark?: boolean; showPreparedFor?: boolean }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2">
      <span className={clsx('text-lg font-bold tracking-tight', dark ? 'text-white' : 'text-navy-900')}>
        Kuroshio <span className={dark ? 'text-teal-300' : 'text-teal-600'}>AI</span>
      </span>
      <span className={clsx('text-sm font-semibold', dark ? 'text-navy-200' : 'text-navy-500')}>EnergyIQ</span>
      {showPreparedFor && (
        <span className={clsx('hidden text-xs sm:inline', dark ? 'text-navy-300' : 'text-navy-400')}>· Prepared for Imdaad</span>
      )}
    </div>
  )
}
