# AnchorFlow — State Flow Document

## Canonical Source of Truth

**`chrome.storage.local`** is the single source of truth for all application state.

No execution context (popup, planner, service worker, content script) maintains authoritative state in memory. All contexts read from and write to storage.

---

## State Categories

### 1. Settings State
- **Written by:** Onboarding, Settings page
- **Read by:** All contexts
- **Update frequency:** Rare (user-initiated)
- **Sync priority:** Low latency not critical

### 2. Task State (Daily Plan)
- **Written by:** Popup, Planner
- **Read by:** Popup, Planner, Service Worker (for overlay payload), Content Script (via message)
- **Update frequency:** Medium (task CRUD, completion)
- **Sync priority:** Must be consistent within 100ms across popup ↔ planner

### 3. Timer State
- **Written by:** Service Worker
- **Read by:** Popup (countdown display), Service Worker (recovery)
- **Update frequency:** On alarm set/fire/reset
- **Sync priority:** Popup reads on mount + storage change listener

### 4. Check-In History
- **Written by:** Service Worker (after AI classification)
- **Read by:** Stats page, Popup (streak/alignment count)
- **Update frequency:** On each check-in (append-only)
- **Sync priority:** Low (stats page refreshes on open)

### 5. Side Quests
- **Written by:** Popup, Content Script (via background)
- **Read by:** Popup, Planner, Stats
- **Update frequency:** Low-medium
- **Sync priority:** Moderate

---

## Hydration Strategy

### Popup Hydration

```
Popup Opens
    │
    ▼
useStorageValue('settings')    ─── parallel ───┐
useStorageValue('dailyPlan')   ─── parallel ───┤
useStorageValue('timerState')  ─── parallel ───┤
useStorageValue('sideQuests')  ─── parallel ───┘
    │
    ▼
Render with data (or loading skeleton if async)
    │
    ▼
Subscribe to chrome.storage.onChanged
    │
    ▼
Live updates from other contexts
```

**Performance rule:** Hydration must complete fast enough for meaningful popup content on open. Use `chrome.storage.local.get([keys])` to batch-read all needed keys in a single call.

### Extension Page Hydration

Same pattern as popup but with more tolerance for loading time. Stats page may show a loading skeleton while computing derived metrics.

### Service Worker Hydration

On wake (alarm fire, message received):
1. Read `settings` for nudge frequency, hard mode
2. Read `dailyPlan` for active task
3. Read `timerState` for recovery if needed

**Critical:** Service worker must not assume any in-memory state is valid. Always read from storage.

### Content Script

Does not hydrate from storage directly. Receives all needed data via message payload from service worker:
- Active task title
- Hard mode setting
- Tone setting

---

## Sync Rules

### Rule 1: Write-Through

All state mutations write to `chrome.storage.local` immediately. React state is then updated from the storage write confirmation or the `onChanged` listener.

```typescript
// Pattern: write-through
async function completeTask(taskId: string) {
  const dailyPlan = await storage.get('dailyPlan')
  const updated = {
    ...dailyPlan,
    tasks: dailyPlan.tasks.map(t =>
      t.id === taskId ? { ...t, completed: true, completedAt: Date.now() } : t
    )
  }
  await storage.set('dailyPlan', updated)
  // React state updates via onChanged listener
}
```

### Rule 2: Single Writer Per Key Per Operation

Only one context writes to a given key at a time for a given operation. This prevents race conditions:

| Key | Primary Writer | Concurrent Risk |
|-----|---------------|----------------|
| `settings` | Settings page / Onboarding | Low (user is in one view) |
| `dailyPlan` | Popup or Planner (not both simultaneously for same task) | Medium — mitigated by optimistic updates with last-write-wins |
| `timerState` | Service Worker only | None |
| `checkinHistory` | Service Worker only (append) | None |
| `sideQuests` | Popup or Content Script (via background) | Low |

### Rule 3: Optimistic UI Updates

For task operations (add, complete, reorder), update React state optimistically, then persist. If persist fails, revert and show error.

```typescript
// Optimistic pattern
setTasks(optimisticTasks)      // immediate UI update
try {
  await storage.set('dailyPlan', { ...plan, tasks: optimisticTasks })
} catch {
  setTasks(previousTasks)       // revert
  showError('Failed to save')
}
```

### Rule 4: Cross-Context Sync via onChanged

```typescript
// useStorageValue hook
function useStorageValue<K extends keyof AnchorFlowStorage>(key: K) {
  const [value, setValue] = useState<AnchorFlowStorage[K] | null>(null)

  useEffect(() => {
    // Initial read
    storage.get(key).then(setValue)

    // Live sync
    const listener = (changes: Record<string, chrome.storage.StorageChange>) => {
      if (key in changes) {
        setValue(changes[key].newValue)
      }
    }
    chrome.storage.onChanged.addListener(listener)
    return () => chrome.storage.onChanged.removeListener(listener)
  }, [key])

  return value
}
```

---

## State Transitions

### Task Lifecycle

```
Created → Active → Completed
   │                    │
   └──── Deleted ◄──────┘ (rare)
```

### Check-In Flow State

```
Idle
  │
  ▼ (alarm fires)
Overlay Shown
  │
  ▼ (user responds)
Classifying (AI pending)
  │
  ▼ (result received)
Feedback Shown
  │
  ├── Continue → Overlay Dismissed → Idle (timer reset)
  ├── Return to Task → Overlay Dismissed → Idle (timer reset)
  ├── Save Side Quest → Side Quest Modal → Overlay Dismissed → Idle
  ├── Snooze → Overlay Dismissed → Idle (short timer)
  └── Switch Task → Task Changed → Overlay Dismissed → Idle (timer reset)
```

### Timer State Machine

```
Stopped
  │
  ▼ (task set as active)
Running
  │
  ├── (alarm fires) → Overlay Active → (response handled) → Running (reset)
  ├── (settings changed) → Running (reset with new interval)
  ├── (active task cleared) → Stopped
  └── (service worker killed) → Stopped
       │
       ▼ (service worker wakes)
       Read timerState → if isRunning && nextFireTime passed → trigger immediately
                       → if isRunning && nextFireTime future → chrome already has alarm
```

---

## Daily Reset

When the user opens the extension on a new day (date changed from `dailyPlan.date`):

1. Archive previous day's plan to history (optional, for stats)
2. Reset `dailyPlan` with new date, empty tasks, no active task
3. Clear `timerState`
4. Keep `sideQuests` that are still pending
5. Keep `checkinHistory` (used by stats)

---

## Data Size Management

- `checkinHistory` grows indefinitely. Implement a retention policy:
  - Keep last 90 days by default
  - Prune on extension open if needed
- `sideQuests` completed items can be pruned after 30 days
- `dailyPlan` is overwritten daily (no growth concern)
