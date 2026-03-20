# AnchorFlow — Failure Modes Document

## Overview

This document enumerates where AnchorFlow can fail and how it should recover. The guiding principle: **the user should never lose trust in the product due to a failure.**

---

## 1. Service Worker Termination

**What happens:** Chrome kills the service worker after ~30 seconds of inactivity (MV3 behavior).

**Impact:** In-memory state is lost. If using `setTimeout`/`setInterval`, timers die.

**Mitigation:**
- Use `chrome.alarms` exclusively for scheduling (persisted by Chrome across SW lifecycle)
- Persist `timerState` to storage on every alarm set/fire
- On service worker wake: read `timerState` from storage, verify alarm exists, recreate if missing
- Never rely on in-memory variables for any critical state

**Recovery behavior:**
- SW wakes on alarm → reads storage → proceeds normally
- If alarm was missed (browser was closed), check `timerState.nextFireTime` on next wake → trigger immediately if overdue

---

## 2. AI API Failure

**What happens:** OpenAI API returns error, times out, or is unreachable.

**Impact:** Check-in classification cannot be performed.

**Mitigation:**
- 10-second timeout on all AI requests
- Deterministic fallback classification:
  - If user selected quick-reply chip → use chip value directly
  - If free text → default to `slightly_off` with generic supportive message
- Fallback copy per classification type pre-written in code (not AI-dependent)

**Recovery behavior:**
- Overlay shows "Classifying..." state immediately
- On timeout/error: switch to fallback instantly, no retry
- Log that fallback was used (for stats accuracy tracking)
- User experience is uninterrupted — they never see an error modal for AI failure

---

## 3. Invalid or Missing API Key

**What happens:** User hasn't entered an API key, or the key is invalid/expired.

**Impact:** AI classification will always fail.

**Mitigation:**
- Detect missing key before attempting AI call
- Use deterministic fallback immediately (no network request)
- Show subtle indicator in popup settings that AI is not configured
- Extension remains fully functional without AI (task management, timer, overlay all work)

**Recovery behavior:**
- Product works as a structured focus tool without AI interpretation
- When user adds valid key, AI classification activates seamlessly

---

## 4. Content Script Injection Failure

**What happens:** `chrome.scripting.executeScript` fails because:
- Tab is a restricted URL (`chrome://`, `chrome-extension://`, `about:blank`)
- Tab has strict CSP that blocks injection
- Tab was closed between alarm fire and injection attempt

**Mitigation:**
- Check tab URL before injection — skip restricted URLs silently
- Wrap `executeScript` in try/catch
- If injection fails, skip this check-in and reset alarm

**Recovery behavior:**
- Log skipped check-in with reason
- Timer resets normally
- User is not shown an error — the check-in simply doesn't appear
- Next check-in will attempt on whatever tab is active then

---

## 5. Overlay Already Visible

**What happens:** A second alarm fires while the overlay from a previous check-in is still showing.

**Mitigation:**
- Track overlay state: `overlayActive: boolean` in service worker memory + storage
- If overlay is active, skip the new alarm trigger
- Reset alarm to fire again after current overlay is resolved

**Recovery behavior:**
- Only one overlay at a time
- No stacked modals or duplicate check-ins

---

## 6. Storage Quota Exceeded

**What happens:** `chrome.storage.local` has a 10MB limit (or 5MB for `sync`). Check-in history grows indefinitely.

**Mitigation:**
- Use `chrome.storage.local` (10MB limit, no sync needed)
- Implement retention policy: prune check-in history older than 90 days
- Prune completed side quests older than 30 days
- Run pruning on extension startup (popup open or SW wake)

**Recovery behavior:**
- If write fails due to quota: show user a warning, suggest clearing old data
- Never silently lose current task data — tasks take priority over history

---

## 7. Popup Opens with Stale Data

**What happens:** User opens popup, but `chrome.storage.onChanged` hasn't fired yet, or initial read returns outdated state.

**Mitigation:**
- Always read fresh from storage on popup mount (not from cache)
- Batch-read all keys in one `chrome.storage.local.get()` call
- Subscribe to `onChanged` immediately after mount

**Recovery behavior:**
- Brief loading state (< 100ms typically)
- Data is always fresh on display

---

## 8. Multiple Tabs Open — Wrong Tab Targeted

**What happens:** Service worker queries active tab but user switched tabs between alarm fire and overlay injection.

**Mitigation:**
- Use `chrome.tabs.query({ active: true, currentWindow: true })` at injection time
- Accept that the overlay appears on whatever tab is active at that moment (this is correct behavior — interrupt where the user is)

**Recovery behavior:**
- Overlay appears on the currently active tab, which is what the user sees
- This is the intended behavior, not a bug

---

## 9. Planner and Popup Write Conflict

**What happens:** User has both popup and planner open, edits tasks in both simultaneously.

**Mitigation:**
- Both read/write the same `dailyPlan` storage key
- `chrome.storage.onChanged` keeps both in sync
- Last-write-wins for the same field
- In practice, conflicts are rare (user is looking at one view at a time)

**Recovery behavior:**
- Both views update reactively via storage listener
- If a write is lost, the user sees the latest state and can re-apply their change
- No merge conflicts or error states

---

## 10. Browser Restart / Crash

**What happens:** Browser closes unexpectedly. All in-memory state is lost.

**Mitigation:**
- All critical state is in `chrome.storage.local` (persists across restart)
- On next popup open: hydrate from storage
- On next SW wake: read `timerState`, restart alarms if needed
- Daily plan is preserved unless the date has changed

**Recovery behavior:**
- User opens extension → sees their tasks exactly as left
- Timer restarts automatically
- No data loss

---

## 11. Date Change (New Day)

**What happens:** User opens the extension on a new day. Yesterday's plan is stale.

**Mitigation:**
- On popup open: compare `dailyPlan.date` with current date
- If different day: archive yesterday's plan (for stats), reset to empty plan
- Preserve pending side quests across days
- Preserve check-in history (used by stats)

**Recovery behavior:**
- Clean slate for the new day
- Yesterday's data available in stats
- No confusing stale tasks

---

## 12. Extension Update

**What happens:** Chrome updates the extension to a new version. Service worker is replaced.

**Mitigation:**
- Storage schema includes a version field
- On install/update event: run migration if schema changed
- Never assume storage structure without validation

**Recovery behavior:**
- Data is migrated transparently
- User doesn't notice the update

---

## 13. Network Connectivity Loss

**What happens:** User is offline. AI classification cannot reach OpenAI.

**Mitigation:**
- Same as AI API failure: deterministic fallback kicks in
- All other features work fully offline (storage, timers, overlays, task management)

**Recovery behavior:**
- Extension works offline with fallback classification
- When connectivity returns, AI classification resumes automatically (no manual action)

---

## Severity Matrix

| Failure | Severity | User Impact | Recovery |
|---------|----------|-------------|----------|
| SW termination | Low | None (chrome.alarms persist) | Automatic |
| AI failure | Low | Degraded feedback quality | Automatic fallback |
| Missing API key | Low | No AI features | Fully functional without AI |
| Content script blocked | Low | Skipped check-in | Automatic, next check-in works |
| Storage quota | Medium | Cannot save new data | User-prompted cleanup |
| Stale popup data | Low | Brief stale display | Automatic on mount |
| Tab targeting | None | By design | N/A |
| Write conflict | Low | Last-write-wins | Automatic sync |
| Browser restart | Low | Timer needs restart | Automatic |
| Date change | None | Expected behavior | Automatic |
| Extension update | Low | Brief interruption | Automatic migration |
| Offline | Low | No AI, all else works | Automatic on reconnect |
