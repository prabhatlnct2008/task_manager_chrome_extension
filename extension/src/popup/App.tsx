import React from 'react'
import { useStorageValue } from '../shared/hooks'
import { OnboardingFlow } from './components/OnboardingFlow'
import { Dashboard } from './components/Dashboard'

export function PopupApp() {
  const { value: settings, loading } = useStorageValue('settings')

  if (loading) {
    return (
      <div className="w-[380px] min-h-[500px] flex items-center justify-center bg-slate-50">
        <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!settings?.onboardingComplete) {
    return <OnboardingFlow />
  }

  return <Dashboard />
}
