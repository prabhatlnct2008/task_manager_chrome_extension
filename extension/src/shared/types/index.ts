export interface Task {
  id: string
  title: string
  completed: boolean
  createdAt: number
  completedAt?: number
  order: number
}

export interface SideQuest {
  id: string
  title: string
  urgency: 'later' | 'today' | 'urgent'
  createdAt: number
  completed: boolean
  sourceCheckinId?: string
}

export type Classification = 'aligned' | 'slightly_off' | 'off_track' | 'break' | 'urgent'

export interface CheckinRecord {
  id: string
  timestamp: number
  activeTaskId: string
  activeTaskTitle: string
  userResponse: string
  classification: Classification
  actionTaken: string
  usedFallback?: boolean
}

export interface Settings {
  apiKey: string
  model: string
  nudgeFrequency: 2 | 15 | 30 | 45 | 60
  hardMode: boolean
  tone: 'gentle' | 'balanced' | 'firm'
  allowSnooze: boolean
  snoozeLimit: number
  onboardingComplete: boolean
}

export interface DailyPlan {
  date: string
  tasks: Task[]
  activeTaskId: string | null
}

export interface TimerState {
  isRunning: boolean
  nextFireTime: number | null
  snoozeCount: number
}

export interface BackupData {
  csv: string
  timestamp: number
}

export interface AnchorFlowStorage {
  settings: Settings
  dailyPlan: DailyPlan
  sideQuests: SideQuest[]
  checkinHistory: CheckinRecord[]
  timerState: TimerState
  lastBackup: BackupData | null
}

// Message types
export type AnchorFlowMessage =
  | { type: 'GET_STATUS' }
  | { type: 'START_TIMER' }
  | { type: 'STOP_TIMER' }
  | { type: 'RESET_TIMER' }
  | { type: 'SAVE_SIDE_QUEST'; payload: { title: string; urgency: 'later' | 'today' | 'urgent'; sourceCheckinId?: string } }
  | { type: 'SHOW_OVERLAY'; payload: ShowOverlayPayload }
  | { type: 'SHOW_FEEDBACK'; payload: ShowFeedbackPayload }
  | { type: 'DISMISS_OVERLAY' }
  | { type: 'CHECKIN_RESPONSE'; payload: CheckinResponsePayload }
  | { type: 'OVERLAY_ACTION'; payload: OverlayActionPayload }
  | { type: 'OVERLAY_DISMISSED'; payload: { reason: string } }

export interface ShowOverlayPayload {
  activeTaskTitle: string
  activeTaskId: string
  hardMode: boolean
  tone: 'gentle' | 'balanced' | 'firm'
  allowSnooze: boolean
  snoozeCount: number
  snoozeLimit: number
}

export interface ShowFeedbackPayload {
  classification: Classification
  message: string
  suggestion: string
  activeTaskTitle: string
  checkinId: string
  availableTasks?: Array<{
    id: string
    title: string
  }>
  ctaOptions: Array<{
    label: string
    action: 'continue' | 'return' | 'save_side_quest' | 'snooze' | 'switch_task'
  }>
}

export interface CheckinResponsePayload {
  userResponse: string
  responseType: 'text' | 'chip'
  chipValue?: 'on_task' | 'distracted' | 'urgent' | 'break'
  activeTaskId: string
}

export interface OverlayActionPayload {
  action: 'continue' | 'return' | 'save_side_quest' | 'snooze' | 'switch_task'
  sideQuestTitle?: string
  targetTaskId?: string
  checkinId: string
}

export interface StatusResponse {
  timerRunning: boolean
  nextCheckinTime: number | null
  activeTaskTitle: string | null
  snoozeCount: number
}

// Planner schedule types
export interface ScheduleChecklistItem {
  text: string
  done: boolean
}

export interface ScheduleBlock {
  id: string
  startTime: string | null
  endTime: string | null
  title: string
  notes: string[]
  items: ScheduleChecklistItem[]
  tags: string[]
}
