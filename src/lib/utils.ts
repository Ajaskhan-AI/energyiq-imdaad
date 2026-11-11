import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Combine class names (used by shadcn/ui components). twMerge removes
 * conflicting Tailwind classes, so `cn('px-2', 'px-4')` gives just `px-4`.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
