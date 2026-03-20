import { useState, useEffect } from 'react'
import type { StatusResponse } from '../types'
import { sendMessage } from '../lib/messaging'

export function useStatus() {
  const [status, setStatus] = useState<StatusResponse | null>(null)

  const refresh = async () => {
    try {
      const result = await sendMessage<StatusResponse>({ type: 'GET_STATUS' })
      setStatus(result)
    } catch {
      // Background may not be ready
    }
  }

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 5000)
    return () => clearInterval(interval)
  }, [])

  return { status, refresh }
}
