import type { Settings, DailyPlan, TimerState } from '../types'
import { getTodayDate } from '../lib/date'

export const DEFAULT_SETTINGS: Settings = {
  apiKey: '',
  model: 'gpt-4o-mini',
  nudgeFrequency: 30,
  hardMode: false,
  tone: 'balanced',
  allowSnooze: true,
  snoozeLimit: 3,
  onboardingComplete: false,
}

export const DEFAULT_DAILY_PLAN: DailyPlan = {
  date: getTodayDate(),
  tasks: [],
  activeTaskId: null,
}

export const DEFAULT_TIMER_STATE: TimerState = {
  isRunning: false,
  nextFireTime: null,
  snoozeCount: 0,
}

export const ALARM_NAME = 'anchorflow-checkin'
export const SNOOZE_ALARM_NAME = 'anchorflow-snooze'
export const SNOOZE_DELAY_MINUTES = 5
export const BACKUP_ALARM_NAME = 'anchorflow-daily-backup'
export const BACKUP_PERIOD_MINUTES = 1440 // 24 hours

export const MODEL_OPTIONS = [
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini', description: 'Fast and affordable' },
  { value: 'gpt-4o', label: 'GPT-4o', description: 'Most capable' },
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo', description: 'Legacy, budget option' },
]

export const NUDGE_OPTIONS: Array<{ value: 15 | 30 | 45 | 60; label: string }> = [
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '60 min' },
]

export const TONE_OPTIONS = [
  { value: 'gentle' as const, label: 'Gentle', description: 'Soft and encouraging' },
  { value: 'balanced' as const, label: 'Balanced', description: 'Supportive but direct' },
  { value: 'firm' as const, label: 'Firm', description: 'Clear and decisive' },
]

export const CLASSIFICATION_CONFIG = {
  aligned: {
    color: 'teal',
    icon: '✓',
    defaultMessage: "You're aligned with your current focus.",
    defaultSuggestion: 'Keep going.',
  },
  slightly_off: {
    color: 'amber',
    icon: '~',
    defaultMessage: 'This seems related, but not your main task right now.',
    defaultSuggestion: 'Would you like to return to the main task or log this for later?',
  },
  off_track: {
    color: 'red',
    icon: '!',
    defaultMessage: "You're currently off the planned task.",
    defaultSuggestion: 'Your intended focus is waiting for you.',
  },
  break: {
    color: 'slate',
    icon: '◯',
    defaultMessage: 'Taking a short break is okay.',
    defaultSuggestion: 'Resume when you are ready.',
  },
  urgent: {
    color: 'blue',
    icon: '⚡',
    defaultMessage: 'This has been logged as an urgent detour.',
    defaultSuggestion: 'Do you want to switch focus or return later?',
  },
} as const
