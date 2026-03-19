import { storage, generateId, getTodayDate } from '../shared/lib/storage'
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

// Alarm handler
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === BACKUP_ALARM_NAME) {
    await performDailyBackup()
    return
  }

  if (alarm.name !== ALARM_NAME && alarm.name !== SNOOZE_ALARM_NAME) return

  if (overlayActive) return

  const { dailyPlan, settings } = await storage.getAll(['dailyPlan', 'settings'])

  if (!dailyPlan?.activeTaskId) return
  if (dailyPlan.date !== getTodayDate()) return

  const activeTask = dailyPlan.tasks.find((t) => t.id === dailyPlan.activeTaskId)
  if (!activeTask || activeTask.completed) return

  // Get active tab
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
  const tab = tabs[0]
  if (!tab?.id || !tab.url) return

  // Skip restricted URLs
  if (
    tab.url.startsWith('chrome://') ||
    tab.url.startsWith('chrome-extension://') ||
    tab.url.startsWith('about:') ||
    tab.url.startsWith('edge://')
  ) {
    resetAlarm()
    return
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js'],
    })
  } catch {
    resetAlarm()
    return
  }

  const timerState = await storage.get('timerState')

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
    resetAlarm()
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
      return {
        timerRunning: timerState.isRunning,
        nextCheckinTime: alarm?.scheduledTime || timerState.nextFireTime,
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
      await resetAlarm()
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

  // Build CTA options based on classification
  const ctaOptions = buildCtaOptions(classification)

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
      await resetAlarm()
      break

    case 'snooze': {
      overlayActive = false
      const timerState = await storage.get('timerState')
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
      await resetAlarm()
      break
    }

    case 'switch_task':
      overlayActive = false
      await resetAlarm()
      break
  }

  return { success: true }
}

function buildCtaOptions(classification: Classification) {
  switch (classification) {
    case 'aligned':
      return [{ label: 'Continue', action: 'continue' as const }]
    case 'slightly_off':
      return [
        { label: 'Return to main task', action: 'return' as const },
        { label: 'Save as side quest', action: 'save_side_quest' as const },
      ]
    case 'off_track':
      return [
        { label: 'Return now', action: 'return' as const },
        { label: 'Save distraction', action: 'save_side_quest' as const },
        { label: 'Snooze once', action: 'snooze' as const },
      ]
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
  await storage.set('timerState', {
    isRunning: false,
    nextFireTime: null,
    snoozeCount: 0,
  })
}

async function resetAlarm() {
  const settings = await storage.get('settings')
  await chrome.alarms.create(ALARM_NAME, { delayInMinutes: settings.nudgeFrequency })
  const alarm = await chrome.alarms.get(ALARM_NAME)
  await storage.set('timerState', {
    isRunning: true,
    nextFireTime: alarm?.scheduledTime || Date.now() + settings.nudgeFrequency * 60000,
    snoozeCount: 0,
  })
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
    if (!existingAlarm) {
      // Alarm was lost, recreate
      if (timerState.nextFireTime && timerState.nextFireTime <= Date.now()) {
        // Overdue — fire immediately by setting 0.1 min delay
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
