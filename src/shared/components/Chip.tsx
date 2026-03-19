import React from 'react'

interface ChipProps {
  label: string
  selected: boolean
  onClick: () => void
}

export function Chip({ label, selected, onClick }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 text-sm rounded-full font-medium transition-colors duration-150 cursor-pointer ${
        selected
          ? 'bg-teal-600 text-white'
          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      }`}
    >
      {label}
    </button>
  )
}

interface ChipGroupProps {
  options: Array<{ value: string; label: string }>
  value: string
  onChange: (value: string) => void
}

export function ChipGroup({ options, value, onChange }: ChipGroupProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <Chip
          key={opt.value}
          label={opt.label}
          selected={value === opt.value}
          onClick={() => onChange(opt.value)}
        />
      ))}
    </div>
  )
}
