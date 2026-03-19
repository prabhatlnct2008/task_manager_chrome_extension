# AnchorFlow — Architecture Document

## System Architecture Overview

AnchorFlow runs as a Chrome Extension (Manifest V3) with four execution contexts that communicate via Chrome's messaging APIs.

```
┌─────────────────────────────────────────────────────┐
│                    Chrome Browser                     │
│                                                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │  Popup   │  │ Ext Pages│  │   Active Tab     │   │
│  │ (React)  │  │ (React)  │  │                  │   │
│  │          │  │ Planner  │  │ ┌──────────────┐ │   │
│  │Dashboard │  │ Stats    │  │ │Content Script│ │   │
│  │Onboarding│  │ Settings │  │ │  (Overlay)   │ │   │
│  └────┬─────┘  └────┬─────┘  │ └──────┬───────┘ │   │
│       │              │        │        │         │   │
│       └──────┬───────┴────────┴────────┘         │   │
│              │  chrome.runtime.sendMessage        │   │
│              │  chrome.storage.onChanged           │   │
│       ┌──────▼──────────────┐                     │   │
│       │  Service Worker     │                     │   │
│       │  (Background)       │                     │   │
│       │                     │                     │   │
│       │  - chrome.alarms    │                     │   │
│       │  - Message router   │                     │   │
│       │  - State manager    │                     │   │
│       └──────┬──────────────┘                     │   │
│              │                                     │   │
│       ┌──────▼──────────────┐                     │   │
│       │ chrome.storage.local│                     │   │
│       │  (Canonical State)  │                     │   │
│       └─────────────────────┘                     │   │
└─────────────────────────────────────────────────────┘
                       │
                       │ HTTPS (fetch)
                       ▼
              ┌────────────────┐
              │  OpenAI API    │
              │  (Classification)│
              └────────────────┘
```

---

## Execution Contexts

### 1. Popup (React SPA)

**Entry:** `src/popup/index.html` → `src/popup/main.tsx`

**Responsibilities:**
- Render main dashboard (current focus, task list, progress, countdown)
- Render onboarding flow on first run
- Handle task CRUD operations
- Display side quest capture modal
- Show check-in countdown

**Lifecycle:** Ephemeral. Destroyed on close, re-created on open. Must hydrate from storage on every mount.

**Key constraint:** Must render meaningful content within 100ms of open.

### 2. Extension Pages (React SPAs)

**Entries:**
- `src/pages/planner/index.html` — Daily planner view
- `src/pages/stats/index.html` — Stats & history view
- `src/pages/settings/index.html` — Settings management

**Responsibilities:**
- Provide full-page views for tasks that need more space
- Planner: two-column planning workspace
- Stats: charts, tables, analytics
- Settings: all configuration controls

**Lifecycle:** Standard tab lifecycle. Can stay open indefinitely.

### 3. Service Worker (Background)

**Entry:** `src/background/index.ts`

**Responsibilities:**
- Manage `chrome.alarms` for check-in scheduling
- Route messages between contexts
- Trigger overlay injection in active tab
- Handle alarm events
- Manage timer state recovery after service worker restart

**Lifecycle:** Ephemeral. Chrome may terminate at any time. Must recover state from storage on wake. No persistent in-memory state.

**Critical rule:** Never store state only in memory. Always persist to `chrome.storage.local`.

### 4. Content Script (Overlay)

**Entry:** `src/content/index.ts`

**Responsibilities:**
- Listen for `SHOW_OVERLAY` messages
- Create Shadow DOM container in host page
- Mount overlay React app inside shadow root
- Capture user response
- Send response back to background
- Clean up overlay on dismissal

**Lifecycle:** Injected per-tab. Survives page navigation only if `chrome.scripting.executeScript` is used dynamically.

**Injection strategy:** Programmatic injection via `chrome.scripting.executeScript` from service worker (not declared in manifest `content_scripts`). This avoids running on every page load.

---

## Storage Model

### Engine: `chrome.storage.local`

All state is stored in `chrome.storage.local` as the single source of truth.

### Schema

```typescript
interface AnchorFlowStorage {
  // User settings
  settings: {
    apiKey: string
    model: string
    nudgeFrequency: 15 | 30 | 45 | 60
    hardMode: boolean
    tone: 'gentle' | 'balanced' | 'firm'
    allowSnooze: boolean
    snoozeLimit: number
    onboardingComplete: boolean
  }

  // Today's plan
  dailyPlan: {
    date: string                    // ISO date (YYYY-MM-DD)
    tasks: Task[]
    activeTaskId: string | null
  }

  // Side quests
  sideQuests: SideQuest[]

  // Check-in history (append-only log)
  checkinHistory: CheckinRecord[]

  // Timer state (for service worker recovery)
  timerState: {
    isRunning: boolean
    nextFireTime: number | null     // epoch ms
    snoozeCount: number
  }
}

interface Task {
  id: string
  title: string
  completed: boolean
  createdAt: number
  completedAt?: number
  order: number
}

interface SideQuest {
  id: string
  title: string
  urgency: 'later' | 'today' | 'urgent'
  createdAt: number
  completed: boolean
  sourceCheckinId?: string          // linked if captured during check-in
}

interface CheckinRecord {
  id: string
  timestamp: number
  activeTaskId: string
  activeTaskTitle: string
  userResponse: string
  classification: 'aligned' | 'slightly_off' | 'off_track' | 'break' | 'urgent'
  actionTaken: string
  aiRawResponse?: string
}
```

### Storage Access Pattern

```typescript
// storage.ts — thin wrapper
export const storage = {
  get: <K extends keyof AnchorFlowStorage>(key: K): Promise<AnchorFlowStorage[K]>
  set: <K extends keyof AnchorFlowStorage>(key: K, value: AnchorFlowStorage[K]): Promise<void>
  update: <K extends keyof AnchorFlowStorage>(key: K, updater: (prev: AnchorFlowStorage[K]) => AnchorFlowStorage[K]): Promise<void>
}
```

### Sync Strategy

All contexts read from `chrome.storage.local`. When any context writes, others receive updates via `chrome.storage.onChanged` listener. React hooks subscribe to these changes:

```typescript
// useStorageValue(key) — React hook
// 1. Reads initial value from storage on mount
// 2. Subscribes to chrome.storage.onChanged
// 3. Updates React state on changes from any context
```

---

## Message Passing Strategy

### Transport: `chrome.runtime.sendMessage` / `chrome.runtime.onMessage`

All messages follow a typed action/payload pattern.

### Flow: Check-In Trigger

```
Service Worker                    Content Script
     │                                 │
     │ ← chrome.alarms fires           │
     │                                 │
     │ chrome.scripting.executeScript   │
     │ ──────────────────────────────►  │
     │                                 │ (script injected)
     │                                 │
     │ chrome.tabs.sendMessage          │
     │ { type: SHOW_OVERLAY,           │
     │   task, settings }              │
     │ ──────────────────────────────►  │
     │                                 │ (overlay mounted)
     │                                 │
     │         USER RESPONDS           │
     │                                 │
     │ chrome.runtime.sendMessage      │
     │ { type: CHECKIN_RESPONSE,       │
     │   response }                    │
     │ ◄──────────────────────────────  │
     │                                 │
     │ → classify via AI               │
     │ → save to checkinHistory        │
     │                                 │
     │ chrome.tabs.sendMessage          │
     │ { type: SHOW_FEEDBACK,          │
     │   classification, message }     │
     │ ──────────────────────────────►  │
     │                                 │ (feedback shown)
     │                                 │
     │ { type: OVERLAY_DISMISSED }     │
     │ ◄──────────────────────────────  │
     │                                 │
     │ → reset alarm                   │
```

---

## AI Service Architecture

### Request Flow

```
Content Script → Background → OpenAI API → Background → Content Script
```

The background service worker owns all AI requests. Content scripts never call external APIs directly.

### Classification Prompt Structure

```
System: You are a focus classification assistant. Given a user's planned task
and their self-reported current activity, classify their state.

User:
Planned task: {activeTaskTitle}
User reports: {userResponse}
Tone: {tone}

Respond with JSON:
{
  "classification": "aligned" | "slightly_off" | "off_track" | "break" | "urgent",
  "message": "Short supportive message",
  "suggestion": "What the user should do next"
}
```

### Fallback Classification

When AI is unavailable (no API key, network error, timeout):

1. Check user's quick-reply chip selection:
   - "working on planned task" → `aligned`
   - "got distracted" → `off_track`
   - "doing something urgent" → `urgent`
   - "taking a short break" → `break`
2. For free text: default to `slightly_off` with generic supportive message

---

## Build Architecture

### Tool: Vite

**Why Vite:**
- Fast dev builds with HMR
- Efficient production builds with Rollup
- Good plugin ecosystem
- Tree-shaking for minimal bundles

### Entry Points (Multi-Page Build)

```javascript
// vite.config.ts
{
  build: {
    rollupOptions: {
      input: {
        popup: 'src/popup/index.html',
        planner: 'src/pages/planner/index.html',
        stats: 'src/pages/stats/index.html',
        settings: 'src/pages/settings/index.html',
        background: 'src/background/index.ts',
        content: 'src/content/index.ts',
      }
    }
  }
}
```

### Output Structure

```
dist/
├── popup.html
├── planner.html
├── stats.html
├── settings.html
├── assets/
│   ├── popup-[hash].js
│   ├── planner-[hash].js
│   ├── stats-[hash].js
│   ├── settings-[hash].js
│   ├── background.js        # no hash (manifest reference)
│   ├── content.js            # no hash (programmatic injection)
│   └── shared-[hash].js     # common chunks
├── manifest.json
└── icons/
```

---

## Manifest V3 Configuration

```json
{
  "manifest_version": 3,
  "name": "AnchorFlow",
  "version": "1.0.0",
  "description": "Stay with the task you chose.",
  "permissions": [
    "storage",
    "alarms",
    "activeTab",
    "scripting"
  ],
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon-16.png",
      "48": "icons/icon-48.png",
      "128": "icons/icon-128.png"
    }
  },
  "background": {
    "service_worker": "assets/background.js",
    "type": "module"
  },
  "icons": {
    "16": "icons/icon-16.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  }
}
```

Note: No `content_scripts` declared. Content script is injected programmatically via `chrome.scripting.executeScript` only when a check-in fires.

---

## Security Considerations

- API key stored in `chrome.storage.local` (encrypted at rest by Chrome)
- API key never exposed to content scripts
- All AI requests flow through service worker
- Content script uses Shadow DOM to prevent XSS interactions with host page
- No eval, no inline scripts in extension pages
- CSP follows Manifest V3 defaults
