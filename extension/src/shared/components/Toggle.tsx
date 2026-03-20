import React from 'react'

interface ToggleProps {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  helperText?: string
}

export function Toggle({ label, checked, onChange, helperText }: ToggleProps) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="space-y-0.5">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        {helperText && <p className="text-xs text-slate-500">{helperText}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${
          checked ? 'bg-teal-600' : 'bg-slate-200'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 mt-0.5 ${
            checked ? 'translate-x-5.5 ml-px' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  )
}
