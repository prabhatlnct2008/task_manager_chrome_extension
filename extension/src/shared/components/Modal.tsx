import React, { useEffect, useRef } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  preventClose?: boolean
  title?: string
}

export function Modal({ open, onClose, children, preventClose = false, title }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open || preventClose) return

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [open, onClose, preventClose])

  if (!open) return null

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={(e) => {
        if (!preventClose && e.target === overlayRef.current) onClose()
      }}
    >
      <div className="w-full max-w-sm mx-4 rounded-2xl border border-slate-200 shadow-xl bg-white p-5 space-y-4">
        {title && <h3 className="text-lg font-semibold text-slate-900">{title}</h3>}
        {children}
      </div>
    </div>
  )
}
