import type { AnchorFlowMessage } from '../types'

export async function sendMessage<T = unknown>(message: AnchorFlowMessage): Promise<T> {
  return chrome.runtime.sendMessage(message)
}

export async function sendTabMessage<T = unknown>(tabId: number, message: AnchorFlowMessage): Promise<T> {
  return chrome.tabs.sendMessage(tabId, message)
}
