import React, { useState } from 'react'
import { useStorageValue } from '../../shared/hooks'
import { Card } from '../../shared/components/Card'
import { Button } from '../../shared/components/Button'
import { Input } from '../../shared/components/Input'
import { Select } from '../../shared/components/Select'
import { ChipGroup } from '../../shared/components/Chip'
import { Toggle } from '../../shared/components/Toggle'
import { Modal } from '../../shared/components/Modal'
import { storage } from '../../shared/lib/storage'
import { sendMessage } from '../../shared/lib/messaging'
import { MODEL_OPTIONS, NUDGE_OPTIONS, TONE_OPTIONS, DEFAULT_SETTINGS, DEFAULT_DAILY_PLAN, DEFAULT_TIMER_STATE } from '../../shared/constants'
import type { Settings } from '../../shared/types'

export function SettingsApp() {
  const { value: settings, loading } = useStorageValue('settings')
  const [showKey, setShowKey] = useState(false)
  const [confirmAction, setConfirmAction] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<string | null>(null)

  if (loading || !settings) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const updateSetting = async <K extends keyof Settings>(key: K, value: Settings[K]) => {
    const updated = { ...settings, [key]: value }
    await storage.set('settings', updated)
    if (key === 'nudgeFrequency') {
      sendMessage({ type: 'RESET_TIMER' }).catch(() => {})
    }
  }

  const testConnection = async () => {
    if (!settings.apiKey) {
      setTestResult('No API key configured.')
      return
    }
    setTestResult('Testing...')
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${settings.apiKey}` },
      })
      if (response.ok) {
        setTestResult('Connection successful!')
      } else {
        setTestResult(`Failed: ${response.status} ${response.statusText}`)
      }
    } catch {
      setTestResult('Connection failed. Check your network and API key.')
    }
    setTimeout(() => setTestResult(null), 5000)
  }

  const handleClearAction = async () => {
    switch (confirmAction) {
      case 'clearPlan':
        await storage.set('dailyPlan', DEFAULT_DAILY_PLAN)
        sendMessage({ type: 'STOP_TIMER' }).catch(() => {})
        break
      case 'clearSideQuests':
        await storage.set('sideQuests', [])
        break
      case 'clearHistory':
        await storage.set('checkinHistory', [])
        break
      case 'resetAll':
        await storage.set('settings', DEFAULT_SETTINGS)
        await storage.set('dailyPlan', DEFAULT_DAILY_PLAN)
        await storage.set('sideQuests', [])
        await storage.set('checkinHistory', [])
        await storage.set('timerState', DEFAULT_TIMER_STATE)
        sendMessage({ type: 'STOP_TIMER' }).catch(() => {})
        break
    }
    setConfirmAction(null)
  }

  const confirmLabels: Record<string, string> = {
    clearPlan: "Clear today's plan? This will remove all current tasks.",
    clearSideQuests: 'Clear all side quests? This cannot be undone.',
    clearHistory: 'Clear all check-in history? Stats will be reset.',
    resetAll: 'Reset everything? All data and settings will be erased.',
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <span className="text-xl">⚓</span>
          <h1 className="text-lg font-semibold text-slate-900">Settings</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-6 space-y-5">
        {/* AI Settings */}
        <Card className="p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">AI Configuration</h2>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700">OpenAI API Key</label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={settings.apiKey}
                onChange={(e) => updateSetting('apiKey', e.target.value)}
                placeholder="sk-..."
                className="w-full px-3 py-2 pr-16 text-sm rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-slate-700 px-2 py-1 cursor-pointer"
              >
                {showKey ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
          <Select
            label="Model"
            options={MODEL_OPTIONS}
            value={settings.model}
            onChange={(v) => updateSetting('model', v)}
          />
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={testConnection}>
              Test Connection
            </Button>
            {testResult && (
              <span className={`text-xs ${testResult.includes('successful') ? 'text-teal-600' : 'text-red-600'}`}>
                {testResult}
              </span>
            )}
          </div>
        </Card>

        {/* Timing */}
        <Card className="p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">Timing</h2>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700">Check-in frequency</label>
            <ChipGroup
              options={NUDGE_OPTIONS.map((o) => ({ value: String(o.value), label: o.label }))}
              value={String(settings.nudgeFrequency)}
              onChange={(v) => updateSetting('nudgeFrequency', Number(v) as 15 | 30 | 45 | 60)}
            />
          </div>
        </Card>

        {/* Overlay Behavior */}
        <Card className="p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">Overlay Behavior</h2>
          <Toggle
            label="Hard Mode"
            checked={settings.hardMode}
            onChange={(v) => updateSetting('hardMode', v)}
            helperText="When enabled, check-ins cannot be dismissed without responding."
          />
          <Toggle
            label="Allow Snooze"
            checked={settings.allowSnooze}
            onChange={(v) => updateSetting('allowSnooze', v)}
            helperText="Allow snoozing check-ins for 5 minutes."
          />
          {settings.allowSnooze && (
            <Input
              label="Snooze Limit"
              value={String(settings.snoozeLimit)}
              onChange={(v) => updateSetting('snoozeLimit', Math.max(1, parseInt(v) || 1))}
              type="number"
              helperText="Maximum snoozes per check-in cycle."
            />
          )}
        </Card>

        {/* Tone */}
        <Card className="p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">Tone</h2>
          <ChipGroup
            options={TONE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            value={settings.tone}
            onChange={(v) => updateSetting('tone', v as 'gentle' | 'balanced' | 'firm')}
          />
          <p className="text-xs text-slate-500">
            {TONE_OPTIONS.find((o) => o.value === settings.tone)?.description}
          </p>
        </Card>

        {/* Data & Reset */}
        <Card className="p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">Data & Reset</h2>
          <div className="space-y-2">
            <Button variant="secondary" size="sm" onClick={() => setConfirmAction('clearPlan')} className="w-full">
              Clear Today's Plan
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setConfirmAction('clearSideQuests')} className="w-full">
              Clear Side Quests
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setConfirmAction('clearHistory')} className="w-full">
              Clear Check-in History
            </Button>
            <Button variant="danger" size="sm" onClick={() => setConfirmAction('resetAll')} className="w-full">
              Reset Everything
            </Button>
          </div>
        </Card>
      </div>

      {/* Confirmation Modal */}
      <Modal
        open={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        title="Are you sure?"
      >
        <p className="text-sm text-slate-600">{confirmAction ? confirmLabels[confirmAction] : ''}</p>
        <div className="flex gap-2 pt-2">
          <Button variant="ghost" onClick={() => setConfirmAction(null)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleClearAction} className="flex-1">
            Confirm
          </Button>
        </div>
      </Modal>
    </div>
  )
}
