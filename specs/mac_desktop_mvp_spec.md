# Mac Desktop MVP Spec

## Goal

Build a local-only macOS desktop prototype that can interrupt the user during work, force a response, and log whether they are on-task or off-track.

This is a test-only MVP. No commits, sync, auth, or production hardening yet.

---

## Product Premise

The core loop is:

1. User starts a focus session.
2. User defines the task they are supposed to be working on.
3. The app interrupts every N minutes.
4. The user must answer what they are doing.
5. If they are on-task, the session continues.
6. If they are off-track, the app applies a simple consequence.

This prototype is meant to validate one thing:

Can a Mac desktop app reliably interrupt active work in apps like Cursor, browser tabs, or other desktop tools, and make the user respond?

---

## Platform

- OS: macOS only
- App type: desktop app
- Runtime for MVP: Electron

Why Electron for MVP:

- fastest path to a working Mac desktop app
- easy always-on-top windows
- easy local state
- good enough for proving the loop

Tauri can be considered later if we want a lighter production app.

---

## MVP Scope

### In Scope

- start a focus session
- enter one current task
- choose a check-in frequency
- show an always-on-top check-in modal every 2 minutes for testing
- require the user to answer before dismissing
- store session/check-in logs locally
- basic on-track vs off-track consequence

### Out of Scope

- accounts
- cloud sync
- mobile support
- browser extension integration
- advanced AI classification
- website blocking
- full internet disabling
- app killing/blocking
- analytics dashboard
- rewards system

---

## Core Behavior

### Session Start

User provides:

- task title
- optional short session note
- check-in frequency
- optional session duration

After pressing `Start Session`:

- the app stores an active session in local storage
- a timer starts
- the app becomes dormant until the next check-in

### Check-In Modal

At each interval:

- an always-on-top modal appears
- it takes focus
- it asks:
  - `What are you doing right now?`
  - `Are you still working on: <task>?`
- the user must either:
  - type a response
  - choose a quick action

Quick actions:

- `Still on task`
- `Slight detour`
- `Off track`
- `Need a break`

### Forced Response

For MVP, “force a response” means:

- modal is always on top
- modal cannot be dismissed with escape or outside click
- modal remains visible until an answer is submitted

We are not yet trying to block all OS interaction. We are proving reliable interruption first.

### Consequence Model

For MVP, keep consequences simple.

If response is:

- `Still on task`
  - close modal
  - continue session
- `Slight detour`
  - show a short redirect message
  - continue session
- `Off track`
  - show stricter redirect message
  - shorten next check-in interval to 1 minute
- `Need a break`
  - allow a 5-minute snooze

No website/app blocking yet in the first prototype.

---

## Success Criteria

The prototype succeeds if all of these are true:

- the app can run locally on macOS
- a user can start a session in under 15 seconds
- the modal appears on schedule even while working in Cursor or another app
- the modal reliably gets attention
- the modal requires an answer
- logs are stored locally and can be inspected
- the consequence feels noticeable enough to influence behavior

---

## App Structure

### Windows

1. Main window
- session setup
- current session status
- last check-in summary

2. Check-in modal window
- small always-on-top focused window
- appears over active work
- minimal UI

### Main Process Responsibilities

- app lifecycle
- timer scheduling
- session state
- opening/focusing modal window
- local persistence

### Renderer Responsibilities

- session form UI
- modal UI
- displaying local history

---

## Local Data Model

```ts
interface FocusSession {
  id: string
  taskTitle: string
  note?: string
  startedAt: number
  endedAt?: number
  frequencyMinutes: number
  status: 'active' | 'paused' | 'ended'
  nextCheckinAt: number | null
}

interface CheckinRecord {
  id: string
  sessionId: string
  timestamp: number
  promptTaskTitle: string
  userResponse: string
  responseType: 'quick' | 'text'
  classification: 'aligned' | 'slightly_off' | 'off_track' | 'break'
  consequence: 'none' | 'shorter_interval' | 'snooze'
}
```

Persistence can be:

- JSON file on disk, or
- `electron-store`

For MVP, `electron-store` is acceptable.

---

## Exact MVP Screens

### Screen 1: Session Setup

Fields:

- `Task title`
- `Check-in frequency`
- `Optional note`

Actions:

- `Start session`
- `End session` if one is active

### Screen 2: Check-In Modal

Contents:

- current task title
- prompt text
- textarea
- quick buttons:
  - `Still on task`
  - `Slight detour`
  - `Off track`
  - `Need a break`
- submit button

### Screen 3: Session History

Minimal local-only list:

- time
- response
- classification
- consequence

---

## Technical Plan

### Step 1

Create an Electron app shell with:

- main window
- preload bridge
- local store

### Step 2

Implement session start/end and persistent active session state.

### Step 3

Implement timer scheduling in the Electron main process.

For MVP:

- use `setTimeout` / `setInterval`
- session state should be persisted
- on restart, if session is active, restore the timer

### Step 4

Implement the always-on-top check-in modal.

Required modal settings:

- always on top
- focused when shown
- non-resizable
- small centered window

### Step 5

Implement quick responses + text response logging.

### Step 6

Implement the simple consequence model:

- aligned -> normal next interval
- off-track -> next interval reduced to 1 minute
- break -> snooze 5 minutes

---

## What We Test First

Use the prototype during actual work in:

- Cursor
- Chrome
- another desktop app

Test questions:

- does the modal appear every time?
- does it steal attention well enough?
- can it be ignored too easily?
- does a forced answer feel useful or just irritating?
- is 2-minute cadence enough to validate the behavior loop?

---

## What We Add Only After MVP Works

Only after the above loop works should we consider:

- blocked app detection
- blocked websites
- browser extension integration
- AI response classification
- stronger consequences
- reward system
- web dashboard
- mobile companion

---

## Recommended Immediate Build Order

1. Electron shell
2. Session state + local persistence
3. 2-minute timer
4. Always-on-top check-in modal
5. Local check-in log
6. One consequence: shorten next interval after off-track response

---

## Decision Guardrail

Do not build advanced blocking or AI features until the following is proven:

`An always-on-top check-in modal on macOS is reliable enough to change user behavior during real work.`

