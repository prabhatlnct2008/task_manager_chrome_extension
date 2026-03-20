import React, { useState } from 'react'
import { Card } from '../../shared/components/Card'
import { Button } from '../../shared/components/Button'
import { Input } from '../../shared/components/Input'
import { Select } from '../../shared/components/Select'
import { ChipGroup } from '../../shared/components/Chip'
import { Toggle } from '../../shared/components/Toggle'
import { storage } from '../../shared/lib/storage'
import { DEFAULT_SETTINGS } from '../../shared/constants'
import { MODEL_OPTIONS, NUDGE_OPTIONS, TONE_OPTIONS } from '../../shared/constants'
import type { Settings } from '../../shared/types'

export function OnboardingFlow() {
  const [step, setStep] = useState(0)
  const [settings, setSettings] = useState<Settings>({ ...DEFAULT_SETTINGS })
  const [showKey, setShowKey] = useState(false)

  const updateField = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  const handleComplete = async () => {
    await storage.set('settings', { ...settings, onboardingComplete: true })
  }

  const steps = [
    // Step 0: Welcome
    <div key="welcome" className="space-y-4 text-center">
      <div className="w-14 h-14 mx-auto bg-teal-50 rounded-2xl flex items-center justify-center">
        <span className="text-2xl">⚓</span>
      </div>
      <h1 className="text-xl font-semibold text-slate-900">AnchorFlow</h1>
      <p className="text-lg font-medium text-slate-800">Stay with the task you chose.</p>
      <p className="text-sm text-slate-500">
        AnchorFlow checks in during your work sessions and helps you stay aligned with your
        intentions. No judgment — just awareness.
      </p>
      <Button onClick={() => setStep(1)} size="lg" className="w-full">
        Get Started
      </Button>
    </div>,

    // Step 1: AI Config
    <div key="ai" className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-900">AI Configuration</h2>
      <p className="text-sm text-slate-500">
        Connect to OpenAI so AnchorFlow can understand your check-in responses. You can skip this
        and add it later.
      </p>
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-slate-700">OpenAI API Key</label>
        <div className="relative">
          <input
            type={showKey ? 'text' : 'password'}
            value={settings.apiKey}
            onChange={(e) => updateField('apiKey', e.target.value)}
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
        <p className="text-xs text-slate-500">Optional — the extension works without AI using simple classification.</p>
      </div>
      <Select
        label="Model"
        options={MODEL_OPTIONS}
        value={settings.model}
        onChange={(v) => updateField('model', v)}
      />
      <div className="flex gap-2">
        <Button variant="ghost" onClick={() => setStep(0)}>
          Back
        </Button>
        <Button onClick={() => setStep(2)} className="flex-1">
          Continue
        </Button>
      </div>
    </div>,

    // Step 2: Behavior
    <div key="behavior" className="space-y-5">
      <h2 className="text-lg font-semibold text-slate-900">Check-In Behavior</h2>
      <p className="text-sm text-slate-500">
        Choose how often you want to be checked in on, and how the check-in should feel.
      </p>
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-slate-700">Check-in frequency</label>
        <ChipGroup
          options={NUDGE_OPTIONS.map((o) => ({ value: String(o.value), label: o.label }))}
          value={String(settings.nudgeFrequency)}
          onChange={(v) => updateField('nudgeFrequency', Number(v) as 15 | 30 | 45 | 60)}
        />
      </div>
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-slate-700">Tone</label>
        <ChipGroup
          options={TONE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          value={settings.tone}
          onChange={(v) => updateField('tone', v as 'gentle' | 'balanced' | 'firm')}
        />
      </div>
      <Toggle
        label="Hard Mode"
        checked={settings.hardMode}
        onChange={(v) => updateField('hardMode', v)}
        helperText="When enabled, you must respond to check-ins before dismissing."
      />
      <div className="flex gap-2">
        <Button variant="ghost" onClick={() => setStep(1)}>
          Back
        </Button>
        <Button onClick={handleComplete} className="flex-1">
          Start Using AnchorFlow
        </Button>
      </div>
      <p className="text-xs text-slate-400 text-center">
        You can change all of these settings later.
      </p>
    </div>,
  ]

  return (
    <div className="w-[380px] min-h-[500px] bg-slate-50 p-4 flex flex-col">
      <Card className="p-5 flex-1">
        {/* Progress dots */}
        <div className="flex justify-center gap-1.5 mb-6">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === step ? 'bg-teal-500' : i < step ? 'bg-teal-300' : 'bg-slate-200'
              }`}
            />
          ))}
        </div>
        {steps[step]}
      </Card>
    </div>
  )
}
