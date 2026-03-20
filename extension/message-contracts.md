# AnchorFlow — Message Contracts

## Overview

All inter-context communication uses `chrome.runtime.sendMessage` (for background ↔ popup/pages) and `chrome.tabs.sendMessage` (for background → content script). Messages follow a typed action/payload pattern.

---

## Message Format

```typescript
interface Message<T extends string, P = undefined> {
  type: T
  payload: P
}
```

---

## Message Catalog

### Background ← Popup / Extension Pages

#### `GET_STATUS`
Request current system status.

```typescript
// Request
{ type: 'GET_STATUS' }

// Response
{
  timerRunning: boolean
  nextCheckinTime: number | null
  activeTaskTitle: string | null
  snoozeCount: number
}
```

#### `START_TIMER`
Start the check-in timer.

```typescript
{ type: 'START_TIMER' }
// Response: { success: boolean }
```

#### `STOP_TIMER`
Stop the check-in timer.

```typescript
{ type: 'STOP_TIMER' }
// Response: { success: boolean }
```

#### `RESET_TIMER`
Reset timer (e.g., after settings change).

```typescript
{ type: 'RESET_TIMER' }
// Response: { success: boolean }
```

#### `SAVE_SIDE_QUEST`
Save a side quest (can come from popup or relayed from content script).

```typescript
{
  type: 'SAVE_SIDE_QUEST',
  payload: {
    title: string
    urgency: 'later' | 'today' | 'urgent'
    sourceCheckinId?: string
  }
}
// Response: { success: boolean, id: string }
```

---

### Background → Content Script (via `chrome.tabs.sendMessage`)

#### `SHOW_OVERLAY`
Trigger the check-in overlay in the active tab.

```typescript
{
  type: 'SHOW_OVERLAY',
  payload: {
    activeTaskTitle: string
    activeTaskId: string
    hardMode: boolean
    tone: 'gentle' | 'balanced' | 'firm'
    allowSnooze: boolean
    snoozeCount: number
    snoozeLimit: number
  }
}
```

#### `SHOW_FEEDBACK`
Show classification feedback in the overlay.

```typescript
{
  type: 'SHOW_FEEDBACK',
  payload: {
    classification: 'aligned' | 'slightly_off' | 'off_track' | 'break' | 'urgent'
    message: string
    suggestion: string
    activeTaskTitle: string
    ctaOptions: Array<{
      label: string
      action: 'continue' | 'return' | 'save_side_quest' | 'snooze' | 'switch_task'
    }>
  }
}
```

#### `DISMISS_OVERLAY`
Force-dismiss the overlay (e.g., if user switches task from popup).

```typescript
{ type: 'DISMISS_OVERLAY' }
```

---

### Background ← Content Script (via `chrome.runtime.sendMessage`)

#### `CHECKIN_RESPONSE`
User's response from the check-in overlay.

```typescript
{
  type: 'CHECKIN_RESPONSE',
  payload: {
    userResponse: string
    responseType: 'text' | 'chip'
    chipValue?: 'on_task' | 'distracted' | 'urgent' | 'break'
    activeTaskId: string
  }
}
```

#### `OVERLAY_ACTION`
User's action from the feedback panel.

```typescript
{
  type: 'OVERLAY_ACTION',
  payload: {
    action: 'continue' | 'return' | 'save_side_quest' | 'snooze' | 'switch_task'
    sideQuestTitle?: string        // if action is save_side_quest
    checkinId: string
  }
}
```

#### `OVERLAY_DISMISSED`
Overlay was dismissed (closed by user or after action).

```typescript
{
  type: 'OVERLAY_DISMISSED',
  payload: {
    reason: 'action_taken' | 'snoozed' | 'escaped' | 'clicked_outside'
  }
}
```

---

## Message Flow Diagrams

### Check-In Flow

```
1. chrome.alarms fires in Service Worker
2. SW reads dailyPlan.activeTaskId + settings from storage
3. SW gets active tab via chrome.tabs.query
4. SW injects content script via chrome.scripting.executeScript (if not already injected)
5. SW sends SHOW_OVERLAY to active tab
6. Content script renders overlay
7. User responds → content script sends CHECKIN_RESPONSE to SW
8. SW calls AI classification (or fallback)
9. SW sends SHOW_FEEDBACK to content script
10. User clicks CTA → content script sends OVERLAY_ACTION to SW
11. SW logs check-in to checkinHistory
12. SW handles action (reset timer, save side quest, etc.)
13. Content script sends OVERLAY_DISMISSED
14. SW resets alarm for next check-in
```

### Side Quest from Overlay

```
1. User is in feedback panel, clicks "Save Side Quest"
2. Content script sends OVERLAY_ACTION { action: 'save_side_quest', sideQuestTitle }
3. SW saves to sideQuests in storage
4. SW sends DISMISS_OVERLAY
5. Content script unmounts overlay
```

---

## Error Handling

### Message Timeout

All message sends should have an implicit timeout. If the content script doesn't respond within 5 seconds, the service worker should:
1. Log the timeout
2. Reset the alarm for the next check-in
3. Not retry the same overlay

### Tab Not Available

If `chrome.tabs.query` returns no active tab, or the tab is a restricted URL (`chrome://`, `chrome-extension://`, `about:`):
1. Skip the check-in silently
2. Reset the alarm
3. Log a skipped check-in

### Content Script Not Injected

If `chrome.tabs.sendMessage` fails (no receiving end):
1. Attempt `chrome.scripting.executeScript` to inject
2. Retry `sendMessage` once after injection
3. If still fails, skip and reset alarm

---

## Type Definitions

```typescript
// All message types as a discriminated union
type AnchorFlowMessage =
  | { type: 'GET_STATUS' }
  | { type: 'START_TIMER' }
  | { type: 'STOP_TIMER' }
  | { type: 'RESET_TIMER' }
  | { type: 'SAVE_SIDE_QUEST'; payload: { title: string; urgency: string; sourceCheckinId?: string } }
  | { type: 'SHOW_OVERLAY'; payload: ShowOverlayPayload }
  | { type: 'SHOW_FEEDBACK'; payload: ShowFeedbackPayload }
  | { type: 'DISMISS_OVERLAY' }
  | { type: 'CHECKIN_RESPONSE'; payload: CheckinResponsePayload }
  | { type: 'OVERLAY_ACTION'; payload: OverlayActionPayload }
  | { type: 'OVERLAY_DISMISSED'; payload: { reason: string } }
```
