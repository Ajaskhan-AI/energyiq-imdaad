import { useMemo, type ReactNode } from 'react'
import { toast } from 'sonner'
import { Toaster } from '@/components/shadcn/sonner'
import type { Tone } from './Badge'
import { ToastContext } from './toastContext'

/**
 * Toast notifications (bottom-right), using shadcn's Sonner. The rest of the
 * app keeps calling toast.show(message, tone) through useToast().
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const api = useMemo(
    () => ({
      show: (message: string, tone: Tone = 'ok') => {
        if (tone === 'ok') toast.success(message)
        else if (tone === 'warn') toast.warning(message)
        else if (tone === 'alert') toast.error(message)
        else toast.info(message)
      },
    }),
    [],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <Toaster position="bottom-right" richColors closeButton visibleToasts={4} duration={5000} />
    </ToastContext.Provider>
  )
}
