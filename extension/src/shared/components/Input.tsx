import React from 'react'

interface InputProps {
  label?: string
  value: string
  onChange: (value: string) => void
  type?: string
  placeholder?: string
  helperText?: string
  className?: string
}

export function Input({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  helperText,
  className = '',
}: InputProps) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && <label className="block text-sm font-medium text-slate-700">{label}</label>}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-shadow"
      />
      {helperText && <p className="text-xs text-slate-500">{helperText}</p>}
    </div>
  )
}
