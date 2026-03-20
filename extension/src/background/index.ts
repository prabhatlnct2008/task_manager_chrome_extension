import { storage, generateId } from '../shared/lib/storage'
import { getTodayDate } from '../shared/lib/date'
import { classifyCheckin, chipToClassification } from '../shared/lib/ai'
import { exportAllToCsv } from '../shared/lib/backup'
import { ALARM_NAME, SNOOZE_ALARM_NAME, SNOOZE_DELAY_MINUTES, BACKUP_ALARM_NAME, BACKUP_PERIOD_MINUTES, CLASSIFICATION_CONFIG } from '../shared/constants'
import type {
  AnchorFlowMessage,
  CheckinRecord,
  CheckinResponsePayload,
  OverlayActionPayload,
  Classification,
  ShowFeedbackPayload,
  StatusResponse,
} from '../shared/types'

let overlayActive = false

const RESTRICTED_URL_PREFIXES = ['chrome://', 'chrome-extension://', 'about:', 'edge://', 'brave://', 'chrome-search://']

function isRestrictedUrl(url: string): boolean {
  return RESTRICTED_URL_PREFIXES.some((prefix) => url.startsWith(prefix))
}

// Alarm handler
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === BACKUP_ALARM_NAME) {
    await performDailyBackup()
    return
  }

  if (alarm.name !== ALARM_NAME && alarm.name !== SNOOZE_ALARM_NAME) return

  // --- Validate preconditions; stop timer cleanly if no active task ---
  const { dailyPlan, settings, timerState } = await storage.getAll(['dailyPlan', 'settings', 'timerState'])

  if (!dailyPlan?.activeTaskId || dailyPlan.date !== getTodayDate()) {
    // No valid plan / stale day — stop the timer
    await stopTimer()
    return
  }

  const activeTask = dailyPlan.tasks.find((t) => t.id === dailyPlan.activeTaskId)
  if (!activeTask || activeTask.completed) {
    await stopTimer()
    return
  }

  // --- Skip-and-rearm conditions ---
  if (overlayActive) {
    // Don't stack overlays, just wait for the next cycle
    await rearmAlarm()
    return
  }

  // Get active tab
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
  const tab = tabs[0]
  if (!tab?.id || !tab.url || isRestrictedUrl(tab.url)) {
    // Tab unavailable or restricted — skip this check-in, schedule next
    await rearmAlarm()
    return
  }

  // Inject content script
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js'],
    })
  } catch {
    // Injection failed — show notification fallback, then rearm
    await showNotificationFallback(activeTask.title)
    await rearmAlarm()
    return
  }

  try {
    await chrome.tabs.sendMessage(tab.id, {
      type: 'SHOW_OVERLAY',
      payload: {
        activeTaskTitle: activeTask.title,
        activeTaskId: activeTask.id,
        hardMode: settings.hardMode,
        tone: settings.tone,
        allowSnooze: settings.allowSnooze,
        snoozeCount: timerState.snoozeCount,
        snoozeLimit: settings.snoozeLimit,
      },
    })
    overlayActive = true
  } catch {
    // Message send failed — notification fallback + rearm
    await showNotificationFallback(activeTask.title)
    await rearmAlarm()
  }
})

// Message handler
chrome.runtime.onMessage.addListener((message: AnchorFlowMessage, _sender, sendResponse) => {
  handleMessage(message).then(sendResponse)
  return true // keep channel open for async response
})

async function handleMessage(message: AnchorFlowMessage): Promise<unknown> {
  switch (message.type) {
    case 'GET_STATUS': {
      const { dailyPlan, timerState } = await storage.getAll(['dailyPlan', 'timerState'])
      const activeTask = dailyPlan?.tasks.find((t) => t.id === dailyPlan?.activeTaskId)
      const alarm = await chrome.alarms.get(ALARM_NAME)
      const snoozeAlarm = await chrome.alarms.get(SNOOZE_ALARM_NAME)
      return {
        timerRunning: timerState.isRunning,
        nextCheckinTime: snoozeAlarm?.scheduledTime || alarm?.scheduledTime || timerState.nextFireTime,
        activeTaskTitle: activeTask?.title || null,
        snoozeCount: timerState.snoozeCount,
      } as StatusResponse
    }

    case 'START_TIMER': {
      await startTimer()
      return { success: true }
    }

    case 'STOP_TIMER': {
      await stopTimer()
      return { success: true }
    }

    case 'RESET_TIMER': {
      await stopTimer()
      await startTimer()
      return { success: true }
    }

    case 'SAVE_SIDE_QUEST': {
      const quest = {
        id: generateId(),
        title: message.payload.title,
        urgency: message.payload.urgency,
        createdAt: Date.now(),
        completed: false,
        sourceCheckinId: message.payload.sourceCheckinId,
      }
      await storage.update('sideQuests', (prev) => [...prev, quest])
      return { success: true, id: quest.id }
    }

    case 'CHECKIN_RESPONSE': {
      return await handleCheckinResponse(message.payload)
    }

    case 'OVERLAY_ACTION': {
      return await handleOverlayAction(message.payload)
    }

    case 'OVERLAY_DISMISSED': {
      overlayActive = false
      await rearmAlarm()
      return { success: true }
    }

    default:
      return { error: 'Unknown message type' }
  }
}

async function handleCheckinResponse(payload: CheckinResponsePayload) {
  const { dailyPlan, settings } = await storage.getAll(['dailyPlan', 'settings'])
  const activeTask = dailyPlan?.tasks.find((t) => t.id === payload.activeTaskId)
  if (!activeTask) return { error: 'No active task' }

  let classification: Classification
  let responseMessage: string
  let suggestion: string
  let usedFallback = false

  if (payload.responseType === 'chip' && payload.chipValue) {
    classification = chipToClassification(payload.chipValue)
    const config = CLASSIFICATION_CONFIG[classification]
    responseMessage = config.defaultMessage
    suggestion = config.defaultSuggestion
    usedFallback = true
  } else {
    const result = await classifyCheckin(activeTask.title, payload.userResponse, settings)
    classification = result.classification
    responseMessage = result.message
    suggestion = result.suggestion
    usedFallback = result.usedFallback
  }

  const checkinId = generateId()
  const record: CheckinRecord = {
    id: checkinId,
    timestamp: Date.now(),
    activeTaskId: payload.activeTaskId,
    activeTaskTitle: activeTask.title,
    userResponse: payload.userResponse,
    classification,
    actionTaken: 'pending',
    usedFallback,
  }

  await storage.update('checkinHistory', (prev) => [...prev, record])

  // Build CTA options based on classification + snooze rules
  const timerState = await storage.get('timerState')
  const ctaOptions = buildCtaOptions(classification, settings.allowSnooze, timerState.snoozeCount, settings.snoozeLimit)

  // Send feedback to content script
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
  if (tabs[0]?.id) {
    const feedbackPayload: ShowFeedbackPayload = {
      classification,
      message: responseMessage,
      suggestion,
      activeTaskTitle: activeTask.title,
      checkinId,
      ctaOptions,
    }
    try {
      await chrome.tabs.sendMessage(tabs[0].id, {
        type: 'SHOW_FEEDBACK',
        payload: feedbackPayload,
      })
    } catch { /* tab may have navigated */ }
  }

  return { success: true, classification, checkinId }
}

async function handleOverlayAction(payload: OverlayActionPayload) {
  // Update the check-in record with the action taken
  await storage.update('checkinHistory', (prev) =>
    prev.map((r) => (r.id === payload.checkinId ? { ...r, actionTaken: payload.action } : r))
  )

  switch (payload.action) {
    case 'continue':
    case 'return':
      overlayActive = false
      await rearmAlarm()
      break

    case 'snooze': {
      overlayActive = false
      const { timerState, settings } = await storage.getAll(['timerState', 'settings'])

      // Enforce snooze limit — if exceeded, treat as a regular rearm
      if (!settings.allowSnooze || timerState.snoozeCount >= settings.snoozeLimit) {
        await rearmAlarm()
        break
      }

      await storage.set('timerState', {
        ...timerState,
        snoozeCount: timerState.snoozeCount + 1,
      })
      await chrome.alarms.create(SNOOZE_ALARM_NAME, { delayInMinutes: SNOOZE_DELAY_MINUTES })
      break
    }

    case 'save_side_quest': {
      if (payload.sideQuestTitle) {
        await storage.update('sideQuests', (prev) => [
          ...prev,
          {
            id: generateId(),
            title: payload.sideQuestTitle!,
            urgency: 'later' as const,
            createdAt: Date.now(),
            completed: false,
            sourceCheckinId: payload.checkinId,
          },
        ])
      }
      overlayActive = false
      await rearmAlarm()
      break
    }

    case 'switch_task':
      overlayActive = false
      await rearmAlarm()
      break
  }

  return { success: true }
}

function buildCtaOptions(
  classification: Classification,
  allowSnooze: boolean,
  snoozeCount: number,
  snoozeLimit: number,
) {
  const canSnooze = allowSnooze && snoozeCount < snoozeLimit

  switch (classification) {
    case 'aligned':
      return [{ label: 'Continue', action: 'continue' as const }]
    case 'slightly_off':
      return [
        { label: 'Return to main task', action: 'return' as const },
        { label: 'Save as side quest', action: 'save_side_quest' as const },
      ]
    case 'off_track': {
      const options: Array<{ label: string; action: 'return' | 'save_side_quest' | 'snooze' }> = [
        { label: 'Return now', action: 'return' },
        { label: 'Save distraction', action: 'save_side_quest' },
      ]
      if (canSnooze) {
        options.push({ label: `Snooze (${snoozeLimit - snoozeCount} left)`, action: 'snooze' })
      }
      return options
    }
    case 'break':
      return [{ label: 'Resume after break', action: 'return' as const }]
    case 'urgent':
      return [
        { label: 'Switch task', action: 'switch_task' as const },
        { label: 'Return later', action: 'return' as const },
      ]
  }
}

async function startTimer() {
  const settings = await storage.get('settings')
  const delayInMinutes = settings.nudgeFrequency
  await chrome.alarms.create(ALARM_NAME, { delayInMinutes })
  const alarm = await chrome.alarms.get(ALARM_NAME)
  await storage.set('timerState', {
    isRunning: true,
    nextFireTime: alarm?.scheduledTime || Date.now() + delayInMinutes * 60000,
    snoozeCount: 0,
  })
}

async function stopTimer() {
  await chrome.alarms.clear(ALARM_NAME)
  await chrome.alarms.clear(SNOOZE_ALARM_NAME)
  overlayActive = false
  await storage.set('timerState', {
    isRunning: false,
    nextFireTime: null,
    snoozeCount: 0,
  })
}

/** Schedule the next regular check-in alarm. Preserves current snoozeCount. */
async function rearmAlarm() {
  const settings = await storage.get('settings')
  const delayInMinutes = settings.nudgeFrequency
  await chrome.alarms.create(ALARM_NAME, { delayInMinutes })
  const alarm = await chrome.alarms.get(ALARM_NAME)
  const timerState = await storage.get('timerState')
  await storage.set('timerState', {
    isRunning: true,
    nextFireTime: alarm?.scheduledTime || Date.now() + delayInMinutes * 60000,
    snoozeCount: timerState.snoozeCount,
  })
}

/** Show a browser notification as fallback when overlay injection fails. */
async function showNotificationFallback(activeTaskTitle: string) {
  try {
    await chrome.notifications.create(`anchorflow-checkin-${Date.now()}`, {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon-128.png'),
      title: 'AnchorFlow Check-in',
      message: `Are you still working on: ${activeTaskTitle}?`,
      priority: 1,
    })
  } catch {
    // Notifications permission may not be available — fail silently
  }
}

// Service worker install/activate
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    // First install — defaults are set by storage layer
  }
})

// Recover timer state on service worker wake
async function recoverTimerState() {
  const timerState = await storage.get('timerState')
  if (timerState.isRunning) {
    const existingAlarm = await chrome.alarms.get(ALARM_NAME)
    const existingSnooze = await chrome.alarms.get(SNOOZE_ALARM_NAME)
    if (!existingAlarm && !existingSnooze) {
      // Alarm was lost, recreate
      if (timerState.nextFireTime && timerState.nextFireTime <= Date.now()) {
        // Overdue — fire soon
        await chrome.alarms.create(ALARM_NAME, { delayInMinutes: 0.1 })
      } else {
        const settings = await storage.get('settings')
        await chrome.alarms.create(ALARM_NAME, { delayInMinutes: settings.nudgeFrequency })
      }
    }
  }
}

recoverTimerState()

// Daily backup
async function performDailyBackup() {
  const csv = await exportAllToCsv()
  await storage.set('lastBackup', { csv, timestamp: Date.now() })
}

async function ensureBackupAlarm() {
  const existing = await chrome.alarms.get(BACKUP_ALARM_NAME)
  if (!existing) {
    await chrome.alarms.create(BACKUP_ALARM_NAME, {
      delayInMinutes: BACKUP_PERIOD_MINUTES,
      periodInMinutes: BACKUP_PERIOD_MINUTES,
    })
  }
}

ensureBackupAlarm()
