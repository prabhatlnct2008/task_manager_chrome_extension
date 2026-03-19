import type { AnchorFlowStorage } from '../types'
import { DEFAULT_SETTINGS, DEFAULT_DAILY_PLAN, DEFAULT_TIMER_STATE } from '../constants'

const DEFAULTS: AnchorFlowStorage = {
  settings: DEFAULT_SETTINGS,
  dailyPlan: DEFAULT_DAILY_PLAN,
  sideQuests: [],
  checkinHistory: [],
  timerState: DEFAULT_TIMER_STATE,
  lastBackup: null,
}

export const storage = {
  async get<K extends keyof AnchorFlowStorage>(key: K): Promise<AnchorFlowStorage[K]> {
    const result = await chrome.storage.local.get(key)
    return (result[key] as AnchorFlowStorage[K] | undefined) ?? DEFAULTS[key]
  },

  async getAll<K extends keyof AnchorFlowStorage>(keys: K[]): Promise<Pick<AnchorFlowStorage, K>> {
    const result = await chrome.storage.local.get(keys as string[])
    const filled: Partial<AnchorFlowStorage> = {}
    for (const key of keys) {
      (filled as Record<string, unknown>)[key] = result[key] ?? DEFAULTS[key]
    }
    return filled as Pick<AnchorFlowStorage, K>
  },

  async set<K extends keyof AnchorFlowStorage>(key: K, value: AnchorFlowStorage[K]): Promise<void> {
    await chrome.storage.local.set({ [key]: value })
  },

  async update<K extends keyof AnchorFlowStorage>(
    key: K,
    updater: (prev: AnchorFlowStorage[K]) => AnchorFlowStorage[K]
  ): Promise<AnchorFlowStorage[K]> {
    const current = await storage.get(key)
    const updated = updater(current)
    await storage.set(key, updated)
    return updated
  },

  onChanged(callback: (changes: Record<string, chrome.storage.StorageChange>) => void): () => void {
    const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === 'local') {
        callback(changes)
      }
    }
    chrome.storage.onChanged.addListener(listener)
    return () => chrome.storage.onChanged.removeListener(listener)
  },
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

export function getTodayDate(): string {
  return new Date().toISOString().split('T')[0]
}
