import React from 'react'

type Status = 'aligned' | 'slightly_off' | 'off_track' | 'break' | 'urgent' | 'focus' | 'drifting' | 'idle' | 'awaiting'

interface StatusBadgeProps {
  status: Status
  label?: string
}

const statusStyles: Record<Status, string> = {
  aligned: 'bg-teal-50 text-teal-700 border-teal-200',
  slightly_off: 'bg-amber-50 text-amber-700 border-amber-200',
  off_track: 'bg-red-50 text-red-700 border-red-200',
  break: 'bg-slate-50 text-slate-600 border-slate-200',
  urgent: 'bg-blue-50 text-blue-700 border-blue-200',
  focus: 'bg-teal-50 text-teal-700 border-teal-200',
  drifting: 'bg-amber-50 text-amber-700 border-amber-200',
  idle: 'bg-slate-50 text-slate-600 border-slate-200',
  awaiting: 'bg-blue-50 text-blue-700 border-blue-200',
}

const defaultLabels: Record<Status, string> = {
  aligned: 'Aligned',
  slightly_off: 'Slightly Off',
  off_track: 'Off Track',
  break: 'On Break',
  urgent: 'Urgent',
  focus: 'In Focus',
  drifting: 'Drifting',
  idle: 'Idle',
  awaiting: 'Awaiting Check-In',
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full border ${statusStyles[status]}`}
    >
      {label || defaultLabels[status]}
    </span>
  )
}
