import { buttonVariants } from '@/components/shadcn/button'
import { cn } from '@/lib/utils'

/**
 * Shared class strings, built on shadcn/ui. Kept in a .ts file (not a
 * component file) so both <button> and <Link> can look like buttons.
 *
 * Variant names are the app's own; they map onto shadcn's button styles:
 * primary / teal → brand blue, secondary → outline, danger → destructive.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'teal' | 'danger' | 'ghost'
export type ButtonSize = 'sm' | 'md' | 'lg'

const VARIANTS = {
  primary: 'default',
  teal: 'default',
  secondary: 'outline',
  danger: 'destructive',
  ghost: 'ghost',
} as const satisfies Record<ButtonVariant, string>

const SIZES = { sm: 'sm', md: 'default', lg: 'lg' } as const satisfies Record<ButtonSize, string>

export function buttonClass(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', extra?: string) {
  return cn(
    buttonVariants({ variant: VARIANTS[variant], size: SIZES[size] }),
    'font-semibold',
    variant === 'secondary' && 'border-navy-200 text-navy-800 hover:border-teal-300 hover:bg-teal-50 hover:text-teal-800',
    size === 'lg' && 'h-11 text-base',
    extra,
  )
}

/** Text inputs, native selects and textareas (shadcn input styling). */
export const inputClass =
  'block w-full min-w-0 rounded-md border border-input bg-white px-3 py-2 text-sm text-navy-900 shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50'
