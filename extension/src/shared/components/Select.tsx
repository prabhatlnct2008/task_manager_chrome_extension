import React from 'react'

interface SelectProps {
  label?: string
  options: Array<{ value: string; label: string; description?: string }>
  value: string
  onChange: (value: string) => void
  helperText?: string
}

export function Select({ label, options, value, onChange, helperText }: SelectProps) {
  return (
    <div className="space-y-1.5">
      {label && <label className="block text-sm font-medium text-slate-700">{label}</label>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent appearance-none cursor-pointer"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}{opt.description ? ` — ${opt.description}` : ''}
          </option>
        ))}
      </select>
      {helperText && <p className="text-xs text-slate-500">{helperText}</p>}
    </div>
  )
}
