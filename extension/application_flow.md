# AnchorFlow

## Application Flow & Functional Specification (Expanded Detailed Version)

---

## 1. Product Overview

**AnchorFlow** is a Chrome Extension designed for users who struggle with task drift, distraction, context switching, and difficulty sustaining intentional work. It acts as a **digital body double inside the browser** by combining structured planning, timed awareness checks, AI-powered interpretation, and redirection.

Unlike a passive to-do list, AnchorFlow is designed to be:

* **proactive**, because it checks in before hours are lost
* **context-aware**, because it compares intended work vs reported activity
* **behaviorally supportive**, because it redirects without shame
* **reflective**, because it shows long-term patterns through stats and history

The product should feel like a calm accountability partner rather than a surveillance system.

---

## 2. Platform & UI Approach

### Platform

* Chrome Extension (Manifest V3)
* Preferred stack: **React + Tailwind CSS**
* Alternative stack: HTML + Tailwind + lightweight JavaScript for simpler MVP builds

### Why React is preferred

The product includes multiple live states:

* popup UI
* settings
* planner
* injected overlay
* progress indicators
* stats/history
* timer-driven behavior

Because of this, React is the better long-term choice for maintainability and component reuse.

### UI Philosophy

The UI should be:

* calm
* minimal
* highly legible
* emotionally safe
* fast to understand
* light on cognitive load

The user should never feel visually attacked by the product.

### Tailwind Design Language

* Cards: `rounded-2xl border border-slate-200 shadow-lg bg-white`
* Panels: generous spacing using `p-4`, `p-5`, `p-6`
* Layout rhythm: `gap-4`, `gap-5`, `space-y-4`
* Typography:

  * headings: `text-lg font-semibold text-slate-900`
  * section labels: `text-sm font-medium text-slate-700`
  * helper text: `text-sm text-slate-500`
* Status colors:

  * focus/aligned: teal or blue-green
  * warning/slight drift: amber
  * off-track: muted red, never aggressive neon red
  * idle/neutral: slate gray

### Visual Tone

The extension should look like a premium focus tool:

* soft shadows
* rounded corners
* low-noise interfaces
* very clear task hierarchy
* no overuse of strong colors
* no cluttered analytics dashboard feel

---

## 3. Core Modules

1. Onboarding / Setup
2. Main Popup Dashboard
3. Daily Planner View
4. Side Quest Capture
5. Intrusion Overlay
6. Feedback / Redirection State
7. Progress Tracking
8. Stats & History
9. Settings
10. Background Engine / Timer Layer
11. Data & Behavioral Logging

---

# SCREEN 1: ONBOARDING / SETUP

## Purpose

Introduce the product, establish trust, and configure the minimum required inputs so the user can start quickly.

This screen should make the product feel understandable and lightweight from the first interaction.

## UI Layout

This can be shown either:

* inside the popup as a step-based onboarding card flow, or
* in a dedicated first-run extension page

### Layout Structure

1. Brand / welcome section
2. Product explanation section
3. AI configuration section
4. behavior settings section
5. completion / save action

## What it should look like

A centered card or stacked panel design with a strong headline, short explanation, and a very simple setup flow.

### Suggested visual hierarchy

* Product name at top
* Headline such as: **“Stay with the task you chose.”**
* One-line helper text explaining that the tool checks in during work and helps redirect attention
* Step indicator or simple progress dots
* Cleanly labeled inputs
* A single prominent completion button

## Inputs / Fields

* **OpenAI API Key**

  * masked text input
  * optional “show” toggle
* **Model Selection**

  * dropdown with short helper text for each model type
* **Nudge Frequency**

  * chips, radio buttons, or segmented control
  * 15 min / 30 min / 45 min / 60 min
* **Hard Mode**

  * toggle switch
  * helper text clarifying that dismissal becomes harder
* **Tone Mode**

  * gentle / balanced / firm

## Functionality

The user should be able to:

* enter and store API key
* choose a model
* set how often the system interrupts
* decide how strict the overlay should be
* choose the tone of feedback
* save settings and move directly into the main dashboard

## UX Rules

* Advanced settings should be hidden under an expandable section
* Setup should not feel technical or enterprise-like
* Copy should be emotionally safe and simple
* The screen should reassure the user that this can be adjusted later

---

# SCREEN 2: MAIN POPUP DASHBOARD

## Purpose

This is the primary daily control center. It gives the user one fast place to understand:

* what today’s plan is
* what the current focus task is
* how much progress has been made
* when the next check-in is coming
* what quick actions are available

## UI Layout

A vertically stacked layout optimized for Chrome popup dimensions.

### Layout Structure

1. Header
2. Current Focus card
3. Task list card
4. Progress section
5. Next check-in section
6. Quick actions row

## What it should look like

The popup should feel extremely clear and scannable.

### Header

* Product name or logo
* compact status pill:

  * In Focus
  * Drifting
  * Idle
  * Awaiting Check-In

### Current Focus Card

This should be the most visually dominant card.

Show:

* label: **Current Focus**
* task title in bold, larger text
* optional subtext: started X minutes ago
* optional button: switch task

### Task List

A clean list with:

* checkboxes
* task names
* active task highlight
* completed tasks faded or struck through

### Progress Section

* horizontal progress bar
* text like: **“4 of 7 tasks complete”**

### Check-In Section

* countdown label: **Next check-in in 12 min**
* small pulse or timer icon

### Quick Actions

* Add Task
* Add Side Quest
* Open Planner

## Functionality

The user should be able to:

* add tasks
* edit tasks
* mark tasks complete
* set a task as active
* see overall progress instantly
* add a side quest without losing the main plan
* open the expanded planner view

## Behavior Rules

* active task must always be obvious
* task completion updates the progress bar immediately
* state must stay consistent across popup, planner, and overlay
* popup must open fast and reflect live state

---

# SCREEN 3: DAILY PLANNER VIEW

## Purpose

Provide a larger, calmer workspace for morning planning or mid-day restructuring when the popup is too cramped.

This is where the user should be able to think a little more clearly and structure the day.

## UI Layout

Full-page extension tab or larger internal page.

### Layout Structure

A two-column layout works best:

**Left column**

* raw thought dump / goal entry area

**Right column**

* structured tasks for the day

## What it should look like

A clear planning workspace with generous margins and reduced visual pressure.

### Left Panel

* large textarea
* headline: **“What needs to happen today?”**
* placeholder text encouraging a quick raw dump

### Right Panel

* structured task list
* drag handle for reorder
* active task selector
* optional tags like priority or estimated effort

## Functionality

The user should be able to:

* dump raw goals into text
* manually convert them into tasks, or optionally use AI assistance
* reorder tasks by importance
* mark one task as the current active task
* edit/delete tasks
* save the day plan

## UX Rules

* this screen should feel more reflective than the popup
* it must not overwhelm with too many options
* priority should come from order first, not a heavy metadata system
* any AI assistance here should be helpful but optional

---

# SCREEN 4: SIDE QUEST CAPTURE

## Purpose

Prevent a distracting or urgent thought from hijacking the current work session.

ADHD users often abandon the current task because a new task feels urgent or emotionally louder. This screen exists to capture that thought without rewarding the derailment.

## UI Layout

A very small modal, sheet, or compact popup card.

### Layout Structure

1. short label / prompt
2. task input field
3. urgency or timing chips
4. save action
5. return-to-task reinforcement message

## What it should look like

Very minimal and frictionless.

### Suggested structure

* prompt: **“What just came up?”**
* single text field
* three chips:

  * later
  * today
  * urgent
* one primary save button

## Functionality

The user should be able to:

* record a new task or thought quickly
* classify it lightly without much effort
* save it without switching away from the active task

## Required Behavior

After saving, the UI should show a reinforcing message like:

**“Saved. Go back to: Finish client deck.”**

The system should preserve the active task unless the user explicitly chooses to switch.

## UX Rules

* no extra form fields unless necessary
* do not make the user explain too much
* saving should feel immediate
* the screen’s job is to reduce derailment, not create more work

---

# SCREEN 5: INTRUSION OVERLAY

## Purpose

Interrupt autopilot behavior and create a moment of conscious awareness.

This is the product’s signature behavior surface.

## Trigger

The overlay is triggered by the timer/background engine using scheduled alarms.

## UI Presentation

Injected into the current active tab.

### Overlay Variants

#### Soft Mode

* semi-transparent darkened background
* subtle page blur
* centered modal card
* visually firm but calm

#### Hard Mode

* more opaque overlay
* stronger contrast
* reduced ability to dismiss casually
* requires explicit action before returning to the page

## Layout Structure

1. title / attention cue
2. current planned task
3. question prompt
4. text response area
5. quick response chips
6. primary action button

## What it should look like

The overlay should feel intentional, not chaotic.

### Content

* title: **“Quick check-in”**
* subline: **“What are you doing right now?”**
* visible planned task label:

  * **Planned focus: Writing proposal intro**
* short text input or response box
* quick reply chips beneath

### Suggested quick reply chips

* working on planned task
* got distracted
* doing something urgent
* taking a short break

## Functionality

The user should be able to:

* respond in free text, or
* choose a quick reply shortcut

The system then:

1. reads the active task
2. reads the user’s response
3. sends both to the AI classification layer
4. receives a judgment and response tone
5. shows a redirection panel

## Hard Mode Behavior

If hard mode is enabled:

* outside click should not dismiss
* escape key should not silently close it unless intentionally allowed
* the user must explicitly answer, snooze, or choose an action

## UX Rules

* interruption should be firm but not visually punishing
* copy should not sound accusing
* the active task must always be visible to create context

---

# SCREEN 6: FEEDBACK / REDIRECTION STATE

## Purpose

After the user answers the check-in, the system needs a **clear response panel** that interprets the situation, closes the loop, and guides the user into the next intentional action.

This is a critical behavioral screen because it determines whether the interruption actually helps the user recover.

## UI Layout

This is part of the overlay flow itself, appearing immediately after the AI classifies the user response.

### Structure

* result icon or status badge
* short interpretation
* one-line redirection
* strong CTA buttons

## What it should look like

A centered response card with a clean hierarchy.

### Visual hierarchy

1. **Status Badge / Result Icon**
2. **Interpretation Message**
3. **Redirection Line**
4. **Action Buttons**

The message must be short, readable, and emotionally neutral.

## Sample States

### 1. Aligned

The user is doing what they intended to do.

Example:

* **“You’re aligned with your current focus.”**
* **“Keep going.”**

CTA:

* Continue

### 2. Slightly Off

The user is doing something adjacent but not central.

Example:

* **“This seems related, but it is not your main task right now.”**
* **“Would you like to return to the main task or log this for later?”**

CTA:

* Return to main task
* Save as side quest

### 3. Off Track

The user is clearly doing something unrelated.

Example:

* **“You’re currently off the planned task.”**
* **“Your intended focus is: Finish report introduction.”**

CTA:

* Return now
* Save distraction
* Snooze once

### 4. Break Accepted

The system recognizes that the user is on an intentional short break.

Example:

* **“Taking a short break is okay.”**
* **“Resume when you’re ready.”**

CTA:

* Resume after break

### 5. Urgent Detour Logged

The system recognizes that the user is handling something urgent that may deserve task switching.

Example:

* **“This has been logged as an urgent detour.”**
* **“Do you want to switch focus or return later?”**

CTA:

* Switch task
* Return later

## Functionality

This state should:

* validate the user without shame
* tell them what the system thinks
* guide them into the next action
* optionally log check-in history
* keep the number of actions limited and obvious

## Design Rules

* no harsh language
* no guilt-based phrasing
* interpretation text should stay short
* no more than 3 CTA buttons at once
* the primary CTA must be visually dominant

---

# SCREEN 7: PROGRESS TRACKING

## Purpose

Give the user a simple day-level awareness of execution without turning the experience into a guilt dashboard.

This screen is not about deep analytics. It is about making daily momentum visible.

## UI Layout

This can appear:

* as a compact card in the popup, and
* as an expanded section in the planner or stats area

### Layout Structure

1. progress summary label
2. progress bar
3. completed vs total task count
4. optional current streak / aligned check-ins count

## What it should look like

A clean card with one strong visual signal and minimal noise.

### Suggested content

* label: **Today’s Progress**
* bar showing completion percentage
* text like: **“5 of 8 tasks complete”**
* optional subtext: **“3 aligned check-ins in a row”**

## Functionality

The user should be able to:

* see completed task count instantly
* understand how much of the plan remains
* observe small reinforcing indicators of staying aligned

## Behavior Rules

* updates should happen instantly when tasks change
* should be visible in popup without needing navigation
* must stay visually calm and uncluttered

---

# SCREEN 8: STATS & HISTORY

## Purpose

Turn AnchorFlow from a day tool into a longer-term behavioral support system.

This screen helps the user understand patterns such as:

* how many tasks they finish
* how often they drift off task
* whether they are improving over time
* how often side quests are created
* how quickly they recover when interrupted

## UI Layout

This should be a **full-page extension view**, not a cramped popup tab.

### Layout Structure

1. page header
2. date range controls
3. summary stat cards
4. charts / trend visualizations
5. activity history table
6. optional insights strip

## What it should look like

This screen should feel like a calm personal reflection tool.

It should not feel like a corporate analytics dashboard.

### Header

* Title: **Your Focus History** or **Focus Stats**
* short helper text: **“A view of how your work patterns are evolving.”**
* date range selector:

  * Today
  * Last 7 days
  * Last 30 days
  * Custom (optional in later phase)

## Section 1: Summary Cards

A responsive grid of cards.

### Card 1: Task Completion

Show:

* total tasks created
* tasks completed
* tasks unfinished
* completion percentage

Example copy:

* **72% completed**
* “18 of 25 tasks finished”

### Card 2: Focus Alignment

Show:

* total check-ins
* on-track count
* off-track count
* alignment percentage

Example copy:

* **68% aligned**
* “You stayed on task during 17 of 25 check-ins”

### Card 3: Side Quest Capture

Show:

* side quests added
* side quests completed later
* side quests still pending

### Card 4: Recovery Efficiency

Show:

* average time to return to task
* successful redirects count
* optional “best day” metric later

## Section 2: Charts / Visual Analytics

Charts should be light, readable, and not overly decorative.

### Chart 1: Daily Completion Trend

* line chart
* x-axis: days
* y-axis: % of tasks completed

### Chart 2: Focus Alignment Trend

* bar chart
* compare on-track vs off-track counts by day

### Chart 3: Activity Heatmap

* simple calendar-style grid showing active focus days or check-in density

## Section 3: Activity Table

A detailed history table for users who want specifics.

### Columns

* Date
* Task Name
* Status (completed / incomplete)
* Number of check-ins during task
* Drift occurrences
* Final outcome

## Section 4: Optional Insight Strip

This can be a lightweight AI-generated or rules-based insight banner, such as:

* **“You tend to drift more in the late afternoon.”**
* **“You complete more tasks on days with fewer side quests.”**

This should be helpful, not diagnostic.

## Functionality

The screen should allow the user to:

* filter stats by date range
* review completion and drift patterns
* inspect individual task outcomes
* see whether they are improving over time

## Psychology Rules

* do not shame the user
* do not overuse red
* emphasize recovery and progress, not failure
* use language like:

  * “You returned to focus 6 times today”
  * “You stayed aligned during 70% of check-ins”
  * “You captured 4 distractions instead of losing them”

---

# SCREEN 9: SETTINGS

## Purpose

Allow the user to control how the system behaves without cluttering the main experience.

## UI Layout

A settings page or slide-over panel with grouped cards or accordions.

### Layout Structure

1. AI settings
2. timing settings
3. overlay behavior settings
4. tone & interaction settings
5. data / reset settings

## What it should look like

A very clean settings interface with clear helper text and grouped controls.

### Group 1: AI Settings

* API key
* selected model
* optional test connection

### Group 2: Timing

* nudge frequency
* working hours window (optional future feature)
* first nudge delay (optional)

### Group 3: Overlay Behavior

* hard mode toggle
* allow snooze toggle
* snooze count limit
* overlay style preference

### Group 4: Tone

* gentle / balanced / firm
* optional motivational phrasing toggle

### Group 5: Data & Reset

* clear today’s plan
* clear side quests
* clear all history
* export data (future)

## Functionality

The user should be able to:

* update settings without friction
* have changes persist immediately
* safely clear/reset data
* understand what each setting does via helper text

## UX Rules

* no hidden surprises
* destructive actions should require confirmation
* settings must stay human-readable, not overly technical

---

# SCREEN 10: BACKGROUND ENGINE / TIMER LAYER

## Purpose

This is the invisible operational layer that keeps the product alive and consistent.

Even though it is not a traditional screen, it must be described functionally because the product depends on it.

## Responsibilities

* run scheduled alarms/check-ins
* persist state across browser sessions where appropriate
* synchronize popup, planner, and overlay state
* trigger overlays in the active tab
* log check-in history and task events

## Functional Requirements

* timer should survive popup close
* extension should not depend on popup being open
* state should remain consistent across multiple tabs
* overlays should target the currently active tab correctly

## UX Implication

The user should experience this layer as invisible reliability.

It should feel like the product simply “knows” the current plan and current task everywhere.

---

# SCREEN 11: DATA & BEHAVIORAL LOGGING

## Purpose

Capture enough structured information to power stats, history, and better reflective UX.

## What should be stored

### User Settings

* API key
* selected model
* nudge frequency
* hard mode setting
* tone preference
* snooze preference

### Daily Plan

* date
* list of tasks
* active task id
* completed flags
* task order
* side quests

### Check-In History

* timestamp
* active task at the time
* user response
* AI classification
* resulting action taken

### Derived Stats Data

* total tasks completed
* drift count
* alignment ratio
* recovery time estimates
* side quest frequency

## UX Rule

This should be designed so that data becomes useful reflection, not silent hoarding.

---

## 4. Behavioral Logic Summary

### Daily Task Flow

1. User creates or updates today’s tasks
2. One task is marked as active
3. Popup and planner show the same state
4. Progress updates when tasks are completed

### Check-In Flow

1. Timer fires
2. Overlay appears
3. User reports current activity
4. System compares it against active task
5. AI classifies state
6. Feedback / redirection panel appears
7. Action is logged
8. Timer resets

### Side Quest Flow

1. New distracting idea appears
2. User captures it quickly
3. Side quest is stored separately
4. User is guided back to current task

### Stats Flow

1. Tasks and check-ins are logged
2. Metrics are updated
3. Charts and history reflect the new state
4. User can review progress by date range

---

## 5. UX Principles

1. **Low friction**
   The user must be able to act quickly without navigating complexity.

2. **Always show the next step**
   At every point, the interface should make the next action obvious.

3. **Supportive tone**
   The system should feel grounding, not critical.

4. **Persistent structure**
   The product should gently hold the day together.

5. **No shame-based design**
   The interface must never punish the user emotionally.

---

## 6. Final Product Summary

**AnchorFlow** is a Chrome-based focus support system that helps users stay aligned with their intended work using structured planning, timed awareness checks, AI-powered task alignment interpretation, side quest capture, and long-term focus analytics. It is designed specifically to reduce invisible drift, improve recovery, and help the user understand their patterns over time through a calm and supportive interface.
