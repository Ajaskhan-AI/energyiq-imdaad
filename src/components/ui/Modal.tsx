import type { ReactNode } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/shadcn/dialog'

interface Props {
  title: string
  onClose: () => void
  children: ReactNode
  /** Usually the form's Cancel / Save buttons. */
  footer?: ReactNode
}

/**
 * Centred dialog, built on the shadcn Dialog (focus is kept inside while open;
 * Escape, the X or clicking outside closes it). Shown while it is rendered.
 */
export function Modal({ title, onClose, children, footer }: Props) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 p-0 sm:max-w-xl">
        <DialogHeader className="border-b border-navy-100 px-5 py-4 pr-12">
          <DialogTitle className="text-lg text-navy-900">{title}</DialogTitle>
          <DialogDescription className="sr-only">{title}</DialogDescription>
        </DialogHeader>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <DialogFooter className="border-t border-navy-100 px-5 py-3">{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  )
}
