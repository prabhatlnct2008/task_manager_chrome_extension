# AnchorFlow — Implementation Phases

## Phase Overview

| Phase | Name | Slices | Focus |
|-------|------|--------|-------|
| 1 | Foundation | 1 | Project setup, build tooling, extension skeleton |
| 2 | Core Loop | 2, 3, 4 | Onboarding, task management, timer engine |
| 3 | Signature Behavior | 5, 6, 7 | Overlay, AI classification, side quests |
| 4 | Extended Views | 8, 9, 10 | Planner, stats, settings pages |
| 5 | Hardening | 11 | Polish, performance, resilience |

---

## Phase 1: Foundation

**Duration estimate:** Initial setup

**Deliverables:**
- Working Vite + React + TypeScript project
- Chrome extension manifest (Manifest V3)
- Tailwind CSS configured with AnchorFlow design tokens
- Base popup rendering in Chrome
- Storage abstraction layer
- Message passing utilities
- Project directory structure

**Directory Structure:**
```
src/
├── popup/           # Popup entry point + components
│   ├── index.html
│   ├── main.tsx
│   └── App.tsx
├── background/      # Service worker
│   └── index.ts
├── content/         # Content script for overlay
│   └── index.ts
├── pages/           # Full-page extension views
│   ├── planner/
│   ├── stats/
│   └── settings/
├── shared/          # Shared across all contexts
│   ├── components/  # Reusable UI components
│   ├── hooks/       # React hooks
│   ├── lib/         # Utilities
│   │   ├── storage.ts
│   │   ├── messaging.ts
│   │   └── ai.ts
│   ├── types/       # TypeScript types
│   └── constants/   # Design tokens, config
├── assets/          # Icons, images
└── styles/          # Global Tailwind config
```

**Exit Criteria:**
- `npm run dev` builds successfully
- Extension loads in Chrome via `chrome://extensions`
- Popup opens and shows React content
- Storage read/write works from popup

---

## Phase 2: Core Loop

**Dependencies:** Phase 1 complete

**Parallel work possible:** Slices 2 and 3 can be developed in parallel. Slice 4 depends on Slice 3 (needs active task concept).

### Slice 2: Onboarding

**Components:**
- `OnboardingFlow` — step-based container
- `ApiKeyStep` — masked input with show toggle
- `ModelSelectStep` — dropdown with helper text
- `BehaviorStep` — nudge frequency chips, hard mode toggle, tone selector
- `OnboardingComplete` — save + transition

**Storage writes:**
```typescript
{
  apiKey: string
  model: string
  nudgeFrequency: 15 | 30 | 45 | 60
  hardMode: boolean
  tone: 'gentle' | 'balanced' | 'firm'
  onboardingComplete: boolean
}
```

### Slice 3: Task Management

**Components:**
- `Dashboard` — main popup layout
- `StatusPill` — In Focus / Drifting / Idle / Awaiting Check-In
- `CurrentFocusCard` — active task highlight
- `TaskList` — checkbox list with active highlight
- `TaskItem` — individual task row
- `ProgressBar` — completion progress
- `CheckInCountdown` — next check-in timer
- `QuickActions` — Add Task, Add Side Quest, Open Planner

**Storage writes:**
```typescript
{
  tasks: Array<{
    id: string
    title: string
    completed: boolean
    createdAt: number
    completedAt?: number
    order: number
  }>
  activeTaskId: string | null
  dailyPlanDate: string  // ISO date
}
```

### Slice 4: Timer Engine

**Service Worker:**
- Listen for `SET_TIMER` messages
- Create `chrome.alarms.create('checkin', { delayInMinutes })`
- On alarm fire: identify active tab, send `SHOW_OVERLAY` message
- Handle alarm reset on settings change
- Persist timer state for service worker recovery

**Exit Criteria:**
- User completes onboarding → sees dashboard
- Can create/edit/delete/complete tasks
- Active task persists across popup close
- Timer fires alarm after configured interval
- Timer survives popup close

---

## Phase 3: Signature Behavior

**Dependencies:** Phase 2 complete (needs tasks, timer, settings)

**Parallel work possible:** Slice 5 + 6 are sequential (overlay then feedback). Slice 7 can be built in parallel with 5+6.

### Slice 5: Intrusion Overlay

**Content Script:**
- Mount Shadow DOM container on `SHOW_OVERLAY` message
- Render overlay UI inside shadow root
- Support soft mode (semi-transparent, blur) and hard mode (opaque, no dismiss)
- Display planned task from message payload
- Capture user response (text or chip)
- Send response back to background via messaging

**Key behaviors:**
- Hard mode: `pointer-events: none` on backdrop, no escape dismiss
- Soft mode: click outside or escape to snooze
- Always show current planned task for context

### Slice 6: AI Classification + Feedback

**AI Service:**
- `classifyCheckin(activeTask: string, userResponse: string, tone: string): Promise<Classification>`
- Classification types: `aligned | slightly_off | off_track | break | urgent`
- Include redirection message in response
- Fallback: keyword-based deterministic classification

**Feedback Panel:**
- Replaces check-in form in overlay
- Shows status badge, interpretation, redirection, CTAs
- CTAs vary by classification (Continue, Return, Save Side Quest, Snooze, Switch Task)

**Check-in Logging:**
```typescript
{
  checkins: Array<{
    id: string
    timestamp: number
    activeTaskId: string
    activeTaskTitle: string
    userResponse: string
    classification: string
    actionTaken: string
  }>
}
```

### Slice 7: Side Quest Capture

**Components:**
- `SideQuestModal` — minimal capture form
- `SideQuestInput` — text field
- `UrgencyChips` — later / today / urgent
- `SideQuestConfirmation` — "Saved. Go back to: [task]"

**Storage:**
```typescript
{
  sideQuests: Array<{
    id: string
    title: string
    urgency: 'later' | 'today' | 'urgent'
    createdAt: number
    completed: boolean
  }>
}
```

**Exit Criteria:**
- Overlay appears on active tab when timer fires
- User can respond via text or chips
- AI classifies response and shows appropriate feedback
- Check-in is logged to history
- Side quests can be captured from popup or overlay
- Active task is preserved after side quest capture

---

## Phase 4: Extended Views

**Dependencies:** Phase 3 complete (needs check-in data for stats)

**Parallel work:** All three slices (8, 9, 10) can be built in parallel.

### Slice 8: Daily Planner

**Entry:** Separate HTML page (`planner.html`) opened as extension tab

**Components:**
- `PlannerLayout` — two-column responsive
- `GoalDumpPanel` — textarea for raw thoughts
- `StructuredTaskPanel` — sortable task list
- `DragHandle` — reorder support
- `TaskEditor` — inline edit/delete

**Sync:** Reads/writes same `tasks` storage key as popup. Storage change listener keeps both in sync.

### Slice 9: Stats & History

**Entry:** Separate HTML page (`stats.html`)

**Components:**
- `StatsHeader` — title + date range selector
- `SummaryCards` — task completion, focus alignment, side quests, recovery
- `CompletionChart` — daily trend line chart
- `AlignmentChart` — on-track vs off-track bar chart
- `ActivityTable` — detailed check-in/task history

**Chart library:** Recharts (lazy-loaded) or lightweight custom SVG

**Stats computation:** Derived from `tasks`, `checkins`, and `sideQuests` storage data, filtered by date range.

### Slice 10: Settings

**Entry:** Separate HTML page or popup sub-view

**Components:**
- `SettingsLayout` — grouped card sections
- `AISettingsGroup` — API key, model, test connection
- `TimingGroup` — nudge frequency, working hours (future)
- `OverlayGroup` — hard mode, snooze toggle, snooze limit
- `ToneGroup` — gentle/balanced/firm
- `DataGroup` — clear plan, clear side quests, clear history (with confirmation)

**Exit Criteria:**
- Planner syncs with popup in real-time
- Stats display accurate data for selected date range
- Settings changes take immediate effect
- Destructive actions require confirmation

---

## Phase 5: Hardening

**Dependencies:** All features built

**Focus areas:**

### Performance
- Audit bundle sizes per entry point (popup, planner, stats, content)
- Target: popup bundle < 100KB gzipped
- Lazy-load charts only on stats page
- Minimize content script footprint
- Profile and fix unnecessary re-renders

### Resilience
- Test service worker termination and recovery
- Test alarm persistence across browser restart
- Handle storage quota limits gracefully
- Validate overlay injection on various sites (SPAs, iframes, CSP-heavy)
- Test with missing/invalid API key

### UX Polish
- Add loading states for all async operations
- Add empty states for tasks, stats, side quests
- Add error states with recovery actions
- Smooth transitions between views
- Keyboard navigation support
- Focus management in overlay

### Edge Cases
- Multiple tabs open — overlay targets correct one
- No tasks created — timer doesn't fire uselessly
- Browser minimized — alarms still fire on restore
- Extension update — data migration path
- Restricted pages (chrome://, about:) — skip overlay gracefully

**Exit Criteria:**
- Extension feels instant and reliable in daily use
- No console errors under normal usage
- Graceful degradation in all failure scenarios
- Visual quality matches spec design language throughout
