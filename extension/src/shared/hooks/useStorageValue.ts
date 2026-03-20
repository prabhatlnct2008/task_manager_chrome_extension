import { useState, useEffect } from 'react'
import type { AnchorFlowStorage } from '../types'
import { storage } from '../lib/storage'

export function useStorageValue<K extends keyof AnchorFlowStorage>(key: K) {
  const [value, setValue] = useState<AnchorFlowStorage[K] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    storage.get(key).then((v) => {
      setValue(v)
      setLoading(false)
    })

    const unsubscribe = storage.onChanged((changes) => {
      if (key in changes) {
        setValue(changes[key].newValue as AnchorFlowStorage[K])
      }
    })

    return unsubscribe
  }, [key])

  const update = async (updater: (prev: AnchorFlowStorage[K]) => AnchorFlowStorage[K]) => {
    const current = value ?? (await storage.get(key))
    const updated = updater(current)
    setValue(updated)
    try {
      await storage.set(key, updated)
    } catch {
      setValue(current)
    }
  }

  const set = async (newValue: AnchorFlowStorage[K]) => {
    const prev = value
    setValue(newValue)
    try {
      await storage.set(key, newValue)
    } catch {
      setValue(prev)
    }
  }

  return { value, loading, update, set }
}
