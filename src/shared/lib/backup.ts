import { storage } from './storage'
import type { AnchorFlowStorage, Task, SideQuest, CheckinRecord } from '../types'

const CSV_HEADER_TASKS = 'type,id,title,completed,createdAt,completedAt,order'
const CSV_HEADER_SIDEQUESTS = 'type,id,title,urgency,createdAt,completed,sourceCheckinId'
const CSV_HEADER_CHECKINS = 'type,id,timestamp,activeTaskId,activeTaskTitle,userResponse,classification,actionTaken,usedFallback'
const CSV_HEADER_SETTINGS = 'type,key,value'
const CSV_HEADER_DAILY_PLAN = 'type,date,activeTaskId'

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return '"' + value.replace(/"/g, '""') + '"'
  }
  return value
}

function taskToCsvRow(task: Task): string {
  return [
    'task',
    escapeCsv(task.id),
    escapeCsv(task.title),
    String(task.completed),
    String(task.createdAt),
    String(task.completedAt ?? ''),
    String(task.order),
  ].join(',')
}

function sideQuestToCsvRow(sq: SideQuest): string {
  return [
    'sidequest',
    escapeCsv(sq.id),
    escapeCsv(sq.title),
    sq.urgency,
    String(sq.createdAt),
    String(sq.completed),
    sq.sourceCheckinId ?? '',
  ].join(',')
}

function checkinToCsvRow(c: CheckinRecord): string {
  return [
    'checkin',
    escapeCsv(c.id),
    String(c.timestamp),
    escapeCsv(c.activeTaskId),
    escapeCsv(c.activeTaskTitle),
    escapeCsv(c.userResponse),
    c.classification,
    c.actionTaken,
    String(c.usedFallback ?? false),
  ].join(',')
}

export async function exportAllToCsv(): Promise<string> {
  const data = await storage.getAll(['dailyPlan', 'sideQuests', 'checkinHistory', 'settings'])
  const lines: string[] = []

  // Section: daily plan metadata
  lines.push(CSV_HEADER_DAILY_PLAN)
  lines.push(['dailyplan', data.dailyPlan.date, data.dailyPlan.activeTaskId ?? ''].join(','))
  lines.push('')

  // Section: tasks
  lines.push(CSV_HEADER_TASKS)
  for (const task of data.dailyPlan.tasks) {
    lines.push(taskToCsvRow(task))
  }
  lines.push('')

  // Section: side quests
  lines.push(CSV_HEADER_SIDEQUESTS)
  for (const sq of data.sideQuests) {
    lines.push(sideQuestToCsvRow(sq))
  }
  lines.push('')

  // Section: checkin history
  lines.push(CSV_HEADER_CHECKINS)
  for (const c of data.checkinHistory) {
    lines.push(checkinToCsvRow(c))
  }
  lines.push('')

  // Section: settings (key-value pairs, excluding apiKey for security)
  lines.push(CSV_HEADER_SETTINGS)
  const settingsEntries = Object.entries(data.settings).filter(([k]) => k !== 'apiKey')
  for (const [key, value] of settingsEntries) {
    lines.push(['setting', escapeCsv(key), escapeCsv(String(value))].join(','))
  }

  return lines.join('\n')
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ',') {
        fields.push(current)
        current = ''
      } else {
        current += ch
      }
    }
  }
  fields.push(current)
  return fields
}

export function parseCsvBackup(csv: string): Partial<AnchorFlowStorage> {
  const lines = csv.split(/\r?\n/)
  const tasks: Task[] = []
  const sideQuests: SideQuest[] = []
  const checkinHistory: CheckinRecord[] = []
  const settingsOverrides: Record<string, string> = {}
  let planDate = new Date().toISOString().split('T')[0]
  let activeTaskId: string | null = null

  for (const line of lines) {
    if (!line.trim() || line.startsWith('type,')) continue

    const fields = parseCsvLine(line)
    const rowType = fields[0]

    switch (rowType) {
      case 'dailyplan':
        planDate = fields[1] || planDate
        activeTaskId = fields[2] || null
        break

      case 'task':
        tasks.push({
          id: fields[1],
          title: fields[2],
          completed: fields[3] === 'true',
          createdAt: Number(fields[4]),
          completedAt: fields[5] ? Number(fields[5]) : undefined,
          order: Number(fields[6]),
        })
        break

      case 'sidequest':
        sideQuests.push({
          id: fields[1],
          title: fields[2],
          urgency: fields[3] as 'later' | 'today' | 'urgent',
          createdAt: Number(fields[4]),
          completed: fields[5] === 'true',
          sourceCheckinId: fields[6] || undefined,
        })
        break

      case 'checkin':
        checkinHistory.push({
          id: fields[1],
          timestamp: Number(fields[2]),
          activeTaskId: fields[3],
          activeTaskTitle: fields[4],
          userResponse: fields[5],
          classification: fields[6] as CheckinRecord['classification'],
          actionTaken: fields[7],
          usedFallback: fields[8] === 'true',
        })
        break

      case 'setting':
        settingsOverrides[fields[1]] = fields[2]
        break
    }
  }

  const result: Partial<AnchorFlowStorage> = {
    dailyPlan: { date: planDate, tasks, activeTaskId },
    sideQuests,
    checkinHistory,
  }

  if (Object.keys(settingsOverrides).length > 0) {
    const settings: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(settingsOverrides)) {
      if (val === 'true') settings[key] = true
      else if (val === 'false') settings[key] = false
      else if (!isNaN(Number(val)) && val !== '') settings[key] = Number(val)
      else settings[key] = val
    }
    result.settings = settings as unknown as AnchorFlowStorage['settings']
  }

  return result
}

export async function restoreFromCsv(csv: string): Promise<void> {
  const data = parseCsvBackup(csv)

  if (data.dailyPlan) {
    await storage.set('dailyPlan', data.dailyPlan)
  }
  if (data.sideQuests) {
    await storage.set('sideQuests', data.sideQuests)
  }
  if (data.checkinHistory) {
    await storage.set('checkinHistory', data.checkinHistory)
  }
  if (data.settings) {
    // Merge with existing settings to preserve apiKey
    const existing = await storage.get('settings')
    await storage.set('settings', { ...existing, ...data.settings })
  }
}

export function downloadCsv(csvContent: string, filename?: string) {
  const date = new Date().toISOString().split('T')[0]
  const name = filename || `anchorflow-backup-${date}.csv`
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}
