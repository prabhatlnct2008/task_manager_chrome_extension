import type {
  ShowOverlayPayload,
  ShowFeedbackPayload,
  Classification,
} from '../shared/types'
import { CLASSIFICATION_CONFIG } from '../shared/constants'

let shadowHost: HTMLDivElement | null = null
let shadowRoot: ShadowRoot | null = null
let escHandler: ((e: KeyboardEvent) => void) | null = null

const OVERLAY_ID = 'anchorflow-overlay-host'

function getOrCreateShadowHost(): { host: HTMLDivElement; root: ShadowRoot } {
  if (shadowHost && shadowRoot) return { host: shadowHost, root: shadowRoot }

  // Remove existing if any
  const existing = document.getElementById(OVERLAY_ID)
  if (existing) existing.remove()

  shadowHost = document.createElement('div')
  shadowHost.id = OVERLAY_ID
  shadowHost.style.cssText = 'all: initial; position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 2147483647; pointer-events: auto;'
  document.body.appendChild(shadowHost)

  shadowRoot = shadowHost.attachShadow({ mode: 'closed' })
  return { host: shadowHost, root: shadowRoot }
}

function cleanupListeners() {
  if (escHandler) {
    document.removeEventListener('keydown', escHandler)
    escHandler = null
  }
}

function removeOverlay(sendDismiss = false) {
  cleanupListeners()
  if (shadowHost) {
    shadowHost.remove()
    shadowHost = null
    shadowRoot = null
  }
  if (sendDismiss) {
    chrome.runtime.sendMessage({ type: 'OVERLAY_DISMISSED', payload: { reason: 'dismissed' } })
  }
}

function renderCheckinOverlay(payload: ShowOverlayPayload) {
  // Clean up any previous listeners before creating new overlay
  cleanupListeners()

  const { root } = getOrCreateShadowHost()

  const styles = `
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .backdrop { position: fixed; inset: 0; background: rgba(0,0,0,${payload.hardMode ? '0.6' : '0.35'}); ${!payload.hardMode ? 'backdrop-filter: blur(4px);' : 'backdrop-filter: blur(8px);'} display: flex; align-items: center; justify-content: center; }
    .card { background: white; border-radius: 20px; padding: 28px; max-width: 400px; width: 90%; box-shadow: 0 20px 60px rgba(0,0,0,0.2); }
    .title { font-size: 18px; font-weight: 600; color: #0f172a; margin-bottom: 4px; }
    .subtitle { font-size: 14px; color: #64748b; margin-bottom: 20px; }
    .task-label { font-size: 12px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 500; }
    .task-name { font-size: 15px; font-weight: 600; color: #0d9488; margin: 4px 0 16px; }
    .input-area { width: 100%; padding: 10px 14px; border: 1px solid #e2e8f0; border-radius: 12px; font-size: 14px; color: #0f172a; outline: none; resize: none; min-height: 44px; }
    .input-area:focus { border-color: #0d9488; box-shadow: 0 0 0 3px rgba(13,148,136,0.1); }
    .chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
    .chip { padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 500; border: 1px solid #e2e8f0; background: #f8fafc; color: #475569; cursor: pointer; transition: all 0.15s; }
    .chip:hover { background: #f0fdfa; border-color: #0d9488; color: #0d9488; }
    .submit-btn { width: 100%; margin-top: 16px; padding: 10px; border-radius: 12px; background: #0d9488; color: white; font-size: 14px; font-weight: 600; border: none; cursor: pointer; transition: background 0.15s; }
    .submit-btn:hover { background: #0f766e; }
    .submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }

    .feedback-badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: 500; margin-bottom: 12px; }
    .badge-aligned { background: #f0fdfa; color: #0f766e; }
    .badge-slightly_off { background: #fffbeb; color: #b45309; }
    .badge-off_track { background: #fef2f2; color: #b91c1c; }
    .badge-break { background: #f8fafc; color: #475569; }
    .badge-urgent { background: #eff6ff; color: #1d4ed8; }
    .feedback-msg { font-size: 15px; font-weight: 500; color: #0f172a; margin-bottom: 6px; }
    .feedback-suggestion { font-size: 14px; color: #64748b; margin-bottom: 16px; }
    .cta-row { display: flex; gap: 8px; flex-wrap: wrap; }
    .cta-btn { flex: 1; min-width: 100px; padding: 10px 16px; border-radius: 12px; font-size: 13px; font-weight: 600; border: none; cursor: pointer; transition: all 0.15s; }
    .cta-primary { background: #0d9488; color: white; }
    .cta-primary:hover { background: #0f766e; }
    .cta-secondary { background: #f1f5f9; color: #475569; }
    .cta-secondary:hover { background: #e2e8f0; }

    .side-quest-input { margin-top: 12px; }
    .pending { text-align: center; padding: 20px; }
    .spinner { display: inline-block; width: 24px; height: 24px; border: 2px solid #e2e8f0; border-top-color: #0d9488; border-radius: 50%; animation: spin 0.6s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
  `

  root.innerHTML = `
    <style>${styles}</style>
    <div class="backdrop" id="af-backdrop">
      <div class="card" id="af-card">
        <div id="af-content">
          <div class="title">Quick check-in</div>
          <div class="subtitle">What are you doing right now?</div>
          <div class="task-label">Planned focus</div>
          <div class="task-name">${escapeHtml(payload.activeTaskTitle)}</div>
          <textarea class="input-area" id="af-response" placeholder="What are you currently working on..."></textarea>
          <div class="chips" id="af-chips">
            <button class="chip" data-value="on_task">Working on planned task</button>
            <button class="chip" data-value="distracted">Got distracted</button>
            <button class="chip" data-value="urgent">Doing something urgent</button>
            <button class="chip" data-value="break">Taking a short break</button>
          </div>
          <button class="submit-btn" id="af-submit" disabled>Submit</button>
        </div>
      </div>
    </div>
  `

  const responseInput = root.getElementById('af-response') as HTMLTextAreaElement
  const submitBtn = root.getElementById('af-submit') as HTMLButtonElement
  const chips = root.getElementById('af-chips')!
  const backdrop = root.getElementById('af-backdrop')!

  let selectedChip: string | null = null

  responseInput.addEventListener('input', () => {
    submitBtn.disabled = !responseInput.value.trim() && !selectedChip
  })

  chips.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest('.chip') as HTMLElement | null
    if (!target) return
    selectedChip = target.dataset.value || null
    responseInput.value = target.textContent || ''
    submitBtn.disabled = false

    // Highlight selected chip
    chips.querySelectorAll('.chip').forEach((c) => {
      ;(c as HTMLElement).style.background = ''
      ;(c as HTMLElement).style.borderColor = ''
      ;(c as HTMLElement).style.color = ''
    })
    target.style.background = '#f0fdfa'
    target.style.borderColor = '#0d9488'
    target.style.color = '#0d9488'
  })

  submitBtn.addEventListener('click', () => {
    const content = root.getElementById('af-content')!
    content.innerHTML = '<div class="pending"><div class="spinner"></div><p style="margin-top:12px;font-size:14px;color:#64748b;">Classifying...</p></div>'

    chrome.runtime.sendMessage({
      type: 'CHECKIN_RESPONSE',
      payload: {
        userResponse: responseInput.value,
        responseType: selectedChip ? 'chip' : 'text',
        chipValue: selectedChip || undefined,
        activeTaskId: payload.activeTaskId,
      },
    })
  })

  // Backdrop click + Escape behavior (soft mode only)
  if (!payload.hardMode) {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        removeOverlay(true)
      }
    })

    escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        removeOverlay(true)
      }
    }
    document.addEventListener('keydown', escHandler)
  }
}

function renderFeedbackPanel(payload: ShowFeedbackPayload) {
  if (!shadowRoot) return

  const content = shadowRoot.getElementById('af-content')
  if (!content) return

  const badgeClass = `badge-${payload.classification}`

  let sideQuestHtml = ''
  const hasSideQuest = payload.ctaOptions.some((o) => o.action === 'save_side_quest')
  if (hasSideQuest) {
    sideQuestHtml = `
      <div class="side-quest-input" id="af-sq-area" style="display:none;">
        <input class="input-area" id="af-sq-input" placeholder="What was it about?" style="min-height:36px;" />
      </div>
    `
  }

  const ctaHtml = payload.ctaOptions
    .map(
      (opt, i) =>
        `<button class="cta-btn ${i === 0 ? 'cta-primary' : 'cta-secondary'}" data-action="${opt.action}">${escapeHtml(opt.label)}</button>`
    )
    .join('')

  content.innerHTML = `
    <div class="feedback-badge ${badgeClass}">
      <span>${CLASSIFICATION_CONFIG[payload.classification].icon}</span>
      <span>${capitalize(payload.classification.replace('_', ' '))}</span>
    </div>
    <div class="feedback-msg">${escapeHtml(payload.message)}</div>
    <div class="feedback-suggestion">${escapeHtml(payload.suggestion)}</div>
    <div class="task-label" style="margin-bottom:16px;">Current focus: <span style="color:#0d9488;font-weight:600;">${escapeHtml(payload.activeTaskTitle)}</span></div>
    ${sideQuestHtml}
    <div class="cta-row" id="af-ctas">${ctaHtml}</div>
  `

  const ctaContainer = shadowRoot.getElementById('af-ctas')!

  ctaContainer.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest('.cta-btn') as HTMLElement | null
    if (!target) return
    const action = target.dataset.action as string

    if (action === 'save_side_quest') {
      const sqArea = shadowRoot!.getElementById('af-sq-area')
      if (sqArea && sqArea.style.display === 'none') {
        sqArea.style.display = 'block'
        const sqInput = shadowRoot!.getElementById('af-sq-input') as HTMLInputElement
        sqInput.focus()
        target.textContent = 'Save & Continue'
        target.dataset.action = 'confirm_side_quest'
        return
      }
    }

    if (action === 'confirm_side_quest') {
      const sqInput = shadowRoot!.getElementById('af-sq-input') as HTMLInputElement
      chrome.runtime.sendMessage({
        type: 'OVERLAY_ACTION',
        payload: {
          action: 'save_side_quest',
          sideQuestTitle: sqInput.value || 'Untitled side quest',
          checkinId: payload.checkinId,
        },
      })
    } else {
      chrome.runtime.sendMessage({
        type: 'OVERLAY_ACTION',
        payload: { action, checkinId: payload.checkinId },
      })
    }

    removeOverlay()
  })
}

// Listen for messages from background
chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
  if (message.type === 'SHOW_OVERLAY') {
    renderCheckinOverlay(message.payload as ShowOverlayPayload)
  } else if (message.type === 'SHOW_FEEDBACK') {
    renderFeedbackPanel(message.payload as ShowFeedbackPayload)
  } else if (message.type === 'DISMISS_OVERLAY') {
    removeOverlay()
  }
})

function escapeHtml(str: string): string {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}
