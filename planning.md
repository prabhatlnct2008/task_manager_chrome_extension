# AnchorFlow — Implementation Plan

## Overview

This document outlines the implementation plan for AnchorFlow, a Chrome Extension (Manifest V3) built with React + Tailwind CSS. The product is a behavioral focus support tool that combines structured planning, timed awareness checks, AI-powered interpretation, and redirection.

---

## Implementation Strategy

### Approach: Vertical Slices

We build complete working flows end-to-end rather than all screens first. Each slice delivers a testable, functional capability.

### Build Order Rationale

1. **Foundation first** — project scaffolding, build tooling, manifest, storage layer
2. **Core task flow** — the daily use loop (create tasks, set active, complete)
3. **Timer + overlay** — the signature product behavior
4. **AI integration** — classification and redirection
5. **Extended views** — planner, stats, history
6. **Polish** — performance tuning, edge cases, UX refinements

---

## Slice Breakdown

### Slice 1: Project Foundation

**Goal:** Buildable Chrome extension skeleton with React rendering in popup.

- Initialize npm project with Vite + React + TypeScript
- Configure Vite for Chrome extension output (popup, background, content script)
- Create `manifest.json` (Manifest V3)
- Set up Tailwind CSS with the design tokens from spec
- Create base popup shell that renders in Chrome
- Set up storage abstraction layer (`chrome.storage.local` wrapper)
- Create message passing utility layer
- Verify: extension loads in Chrome, popup opens with React content

### Slice 2: Onboarding Flow

**Goal:** First-run experience that captures settings and transitions to dashboard.

- Detect first-run state (no settings in storage)
- Build onboarding step flow (API key, model, nudge frequency, hard mode, tone)
- Save settings to storage
- Transition to main dashboard on completion
- Verify: settings persist across popup close/reopen

### Slice 3: Task Management Core

**Goal:** Full task CRUD in popup dashboard with active task selection and progress.

- Build task data model and storage operations
- Create main popup dashboard layout (header, focus card, task list, progress, quick actions)
- Implement add/edit/delete/complete task
- Implement active task selection with visual highlight
- Build progress bar (X of Y tasks complete)
- Verify: tasks persist, active task survives popup close, progress updates instantly

### Slice 4: Background Timer Engine

**Goal:** Reliable timer that fires check-in alarms independent of popup state.

- Implement service worker with `chrome.alarms` API
- Read nudge frequency from settings
- Start/stop/reset timer on task activation
- Handle service worker wake/sleep lifecycle
- Send message to trigger overlay when alarm fires
- Verify: alarm fires correctly even with popup closed, timer resets on settings change

### Slice 5: Intrusion Overlay

**Goal:** Content script overlay injected into active tab on check-in trigger.

- Create content script with Shadow DOM isolation
- Build overlay UI (soft mode and hard mode variants)
- Display current planned task in overlay
- Implement quick response chips + free text input
- Handle hard mode behavior (no outside click dismiss, no escape)
- Wire message passing: background → content script → overlay display
- Verify: overlay appears on active tab, captures user response, sends it back

### Slice 6: AI Classification + Feedback

**Goal:** User response is classified by AI, and appropriate redirection is shown.

- Build AI service layer (OpenAI API integration)
- Define classification prompt (aligned / slightly off / off-track / break / urgent)
- Send active task + user response to AI
- Parse classification result
- Build feedback/redirection panel with appropriate CTAs per state
- Implement deterministic fallback when AI fails
- Log check-in result to storage
- Verify: end-to-end flow from overlay response to feedback display

### Slice 7: Side Quest Capture

**Goal:** Quick capture of distracting thoughts without derailing focus.

- Build side quest modal/sheet UI
- Implement capture with urgency chips (later/today/urgent)
- Save side quests to storage separately from main tasks
- Show reinforcement message after save ("Saved. Go back to: [task]")
- Accessible from popup quick actions and overlay feedback
- Verify: side quests persist, main task remains active

### Slice 8: Daily Planner View

**Goal:** Full-page planning workspace for morning planning or restructuring.

- Create extension page (new tab) for planner
- Build two-column layout (raw dump left, structured tasks right)
- Implement raw text → manual task conversion
- Add drag-and-drop reorder for tasks
- Sync tasks with popup state via storage
- Verify: changes in planner reflect in popup and vice versa

### Slice 9: Stats & History

**Goal:** Full-page analytics view showing behavioral patterns over time.

- Create extension page for stats
- Build date range selector (today, 7 days, 30 days)
- Compute derived stats from check-in history
- Build summary cards (completion rate, alignment rate, side quests, recovery)
- Add simple charts (daily completion trend, focus alignment trend)
- Build activity history table
- Use lightweight charting (e.g., recharts or custom SVG)
- Verify: stats update as new check-ins and tasks are logged

### Slice 10: Settings Page

**Goal:** Full settings management with grouped controls.

- Build settings page (extension page or slide-over)
- Group: AI settings, timing, overlay behavior, tone, data/reset
- Wire all settings to storage with immediate persistence
- Implement destructive action confirmations (clear data)
- Verify: settings changes take effect immediately across all views

### Slice 11: Polish & Hardening

**Goal:** Production-quality UX and resilience.

- Audit and optimize bundle size
- Add loading, empty, and error states to all views
- Test service worker recovery scenarios
- Test multi-tab behavior
- Smooth transitions and animations
- Accessibility audit (keyboard nav, screen reader labels)
- Final visual QA against spec design tokens

---

## Key Technical Decisions

### Build Tool: Vite

- Fast dev builds, efficient production output
- Plugin ecosystem for Chrome extensions (e.g., `@crxjs/vite-plugin` or manual config)
- Tree-shaking for minimal bundle

### State Management: React Context + Storage Sync

- No external state library needed for this scope
- `chrome.storage.local` is the canonical source of truth
- React contexts hydrate from storage on mount
- Storage change listeners keep views in sync

### AI Layer: Thin OpenAI wrapper

- Direct fetch to OpenAI API (no SDK to reduce bundle)
- Single classification prompt with structured output
- Deterministic fallback copy for failures
- Non-blocking (overlay shows pending state)

### Content Script Isolation: Shadow DOM

- Overlay styles don't leak into host page
- Host page styles don't affect overlay
- Clean mount/unmount lifecycle

### Charts: Lightweight

- Recharts (if bundle acceptable) or custom SVG
- Lazy-loaded only on stats page
- No chart library in popup bundle

---

## Risk Areas

| Risk | Mitigation |
|------|-----------|
| Service worker killed mid-timer | Use `chrome.alarms` (persisted by Chrome), not `setTimeout` |
| Storage race conditions | Single-writer pattern, atomic updates |
| Content script blocked by CSP | Shadow DOM + inline styles, no external resources |
| AI latency blocking UX | Show pending state immediately, timeout + fallback |
| Bundle too large for popup | Code-split: popup, planner, stats as separate entry points |
| Overlay injection in restricted tabs | Graceful skip for chrome://, edge cases |

---

## Definition of Done

Each slice is considered done when:

1. Feature works end-to-end in Chrome
2. State persists correctly across popup close/reopen
3. No console errors or warnings
4. UI matches spec design language
5. Edge cases handled (empty states, errors, missing data)
