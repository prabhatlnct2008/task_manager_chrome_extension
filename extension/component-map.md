# AnchorFlow — Component Map

## Component Hierarchy

### Design System / Shared Components

These are reusable primitives used across all views.

| Component | Purpose | Props |
|-----------|---------|-------|
| `Card` | Surface container | `children, className` |
| `Button` | Primary/secondary/ghost actions | `variant, size, children, onClick, disabled` |
| `Input` | Text input with label | `label, value, onChange, type, placeholder, helperText` |
| `Chip` | Selectable option chip | `label, selected, onClick` |
| `ChipGroup` | Group of selectable chips | `options, value, onChange, multi` |
| `Toggle` | Boolean switch | `label, checked, onChange, helperText` |
| `Select` | Dropdown selector | `label, options, value, onChange, helperText` |
| `ProgressBar` | Horizontal progress | `value, max, label` |
| `StatusBadge` | Colored status indicator | `status, label` |
| `Modal` | Overlay modal container | `open, onClose, children, preventClose` |
| `IconButton` | Icon-only button | `icon, onClick, label (aria)` |
| `EmptyState` | No-data placeholder | `icon, title, description, action` |
| `LoadingState` | Spinner/skeleton | `message` |

---

## Popup Components

### Top-Level
```
PopupApp
├── OnboardingFlow (if !onboardingComplete)
│   ├── WelcomeStep
│   ├── ApiKeyStep
│   ├── ModelSelectStep
│   ├── BehaviorStep
│   └── CompleteStep
│
└── Dashboard (if onboardingComplete)
    ├── DashboardHeader
    │   ├── Logo
    │   └── StatusPill
    ├── CurrentFocusCard
    ├── TaskList
    │   └── TaskItem (×N)
    ├── ProgressSection
    │   └── ProgressBar
    ├── CheckInCountdown
    ├── QuickActions
    │   ├── Button (Add Task)
    │   ├── Button (Add Side Quest)
    │   └── Button (Open Planner)
    ├── AddTaskModal
    └── SideQuestModal
        ├── SideQuestInput
        ├── UrgencyChips
        └── SideQuestConfirmation
```

### Component Details

| Component | Owner View | Purpose |
|-----------|-----------|---------|
| `PopupApp` | Popup | Root with routing between onboarding/dashboard |
| `OnboardingFlow` | Popup | Step-based setup wizard |
| `WelcomeStep` | Popup | Brand intro + product explanation |
| `ApiKeyStep` | Popup | Masked API key input |
| `ModelSelectStep` | Popup | Model dropdown selection |
| `BehaviorStep` | Popup | Nudge frequency, hard mode, tone |
| `CompleteStep` | Popup | Save + transition |
| `Dashboard` | Popup | Main control center |
| `DashboardHeader` | Popup | Logo + status indicator |
| `StatusPill` | Popup | In Focus / Drifting / Idle / Awaiting |
| `CurrentFocusCard` | Popup | Active task highlight card |
| `TaskList` | Popup, Planner | Sortable task list |
| `TaskItem` | Popup, Planner | Single task row with checkbox |
| `ProgressSection` | Popup | Completion summary |
| `CheckInCountdown` | Popup | Next check-in timer |
| `QuickActions` | Popup | Action button row |
| `AddTaskModal` | Popup | New task creation form |
| `SideQuestModal` | Popup, Overlay | Quick capture form |

---

## Planner Page Components

```
PlannerApp
├── PlannerHeader
│   ├── Logo
│   └── Button (Back to Popup)
├── PlannerLayout (two-column)
│   ├── GoalDumpPanel
│   │   ├── GoalTextarea
│   │   └── Button (Convert to Tasks — optional AI)
│   └── StructuredTaskPanel
│       ├── TaskList (reused)
│       │   └── TaskItem (×N, with DragHandle)
│       ├── ActiveTaskSelector
│       └── Button (Save Plan)
└── PlannerFooter
```

---

## Stats Page Components

```
StatsApp
├── StatsHeader
│   ├── Title
│   └── DateRangeSelector
├── SummaryCards (grid)
│   ├── StatCard (Task Completion)
│   ├── StatCard (Focus Alignment)
│   ├── StatCard (Side Quests)
│   └── StatCard (Recovery Efficiency)
├── ChartsSection
│   ├── CompletionTrendChart
│   ├── AlignmentChart
│   └── ActivityHeatmap (future)
├── ActivityTable
│   └── ActivityRow (×N)
└── InsightStrip (optional)
```

---

## Settings Page Components

```
SettingsApp
├── SettingsHeader
├── SettingsGroup (AI Settings)
│   ├── Input (API Key)
│   ├── Select (Model)
│   └── Button (Test Connection)
├── SettingsGroup (Timing)
│   ├── ChipGroup (Nudge Frequency)
│   └── Toggle (First Nudge Delay — future)
├── SettingsGroup (Overlay Behavior)
│   ├── Toggle (Hard Mode)
│   ├── Toggle (Allow Snooze)
│   └── Input (Snooze Limit)
├── SettingsGroup (Tone)
│   └── ChipGroup (gentle / balanced / firm)
└── SettingsGroup (Data & Reset)
    ├── Button (Clear Today's Plan)
    ├── Button (Clear Side Quests)
    ├── Button (Clear All History)
    └── ConfirmationModal
```

---

## Content Script / Overlay Components

```
OverlayApp (inside Shadow DOM)
├── OverlayBackdrop
├── CheckInCard
│   ├── CheckInHeader ("Quick check-in")
│   ├── PlannedTaskLabel
│   ├── ResponseInput
│   ├── QuickReplyChips
│   └── Button (Submit)
│
└── FeedbackCard (replaces CheckInCard after classification)
    ├── StatusBadge
    ├── InterpretationMessage
    ├── RedirectionLine
    └── ActionButtons (varies by classification)
        ├── Button (Continue / Return / Resume)
        ├── Button (Save Side Quest — optional)
        └── Button (Snooze — optional)
```

---

## Component Reuse Map

| Component | Used In |
|-----------|---------|
| `Card` | All views |
| `Button` | All views |
| `Input` | Onboarding, Settings, Overlay, AddTask |
| `TaskList` | Popup Dashboard, Planner |
| `TaskItem` | Popup Dashboard, Planner |
| `SideQuestModal` | Popup, Overlay feedback |
| `StatusBadge` | Dashboard, Overlay feedback |
| `ProgressBar` | Dashboard, Planner |
| `ChipGroup` | Onboarding, Settings, Overlay |
| `Toggle` | Onboarding, Settings |
| `Select` | Onboarding, Settings |
| `Modal` | AddTask, SideQuest, Settings confirm |
