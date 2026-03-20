import React, { useState, useMemo, useRef } from 'react'
import { useStorageValue } from '../../shared/hooks'
import { Card } from '../../shared/components/Card'
import { Button } from '../../shared/components/Button'
import { Modal } from '../../shared/components/Modal'
import { storage, generateId } from '../../shared/lib/storage'
import { getTodayDate } from '../../shared/lib/date'
import { sendMessage } from '../../shared/lib/messaging'
import { parseSchedule } from '../../shared/lib/scheduleParser'
import { extractTasksFromPlanText } from '../../shared/lib/ai'
import type { Task, DailyPlan, ScheduleBlock } from '../../shared/types'
import { DEFAULT_DAILY_PLAN } from '../../shared/constants'

type InputMode = 'quick' | 'schedule'

export function PlannerApp() {
  const { value: dailyPlan, loading } = useStorageValue('dailyPlan')
  const [goalText, setGoalText] = useState('')
  const [inputMode, setInputMode] = useState<InputMode>('quick')
  const [parsedBlocks, setParsedBlocks] = useState<ScheduleBlock[]>([])
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set()) // "blockId:itemIdx" or "blockId:title"
  const [isConverting, setIsConverting] = useState(false)
  const [conversionHint, setConversionHint] = useState<string | null>(null)
  const [showClearTasksConfirm, setShowClearTasksConfirm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const dragItem = useRef<number | null>(null)
  const dragOverItem = useRef<number | null>(null)

  const plan = useMemo(() => {
    if (!dailyPlan) return DEFAULT_DAILY_PLAN
    if (dailyPlan.date !== getTodayDate()) {
      return { ...DEFAULT_DAILY_PLAN, date: getTodayDate() }
    }
    return dailyPlan
  }, [dailyPlan])

  const tasks = [...plan.tasks].sort((a, b) => a.order - b.order)

  const savePlan = async (updated: DailyPlan) => {
    await storage.set('dailyPlan', updated)
  }

  // --- Quick mode: simple line-per-task ---
  const convertGoalsToTasks = async () => {
    if (!goalText.trim()) return

    setIsConverting(true)
    setConversionHint(null)

    try {
      const settings = await storage.get('settings')
      const result = await extractTasksFromPlanText(goalText, settings)

      if (result.tasks.length === 0) {
        setConversionHint('No usable tasks were found in that text.')
        return
      }

      const newTasks: Task[] = result.tasks.map((taskTitle, i) => ({
        id: generateId(),
        title: taskTitle,
        completed: false,
        createdAt: Date.now(),
        order: tasks.length + i,
      }))

      const updatedPlan: DailyPlan = {
        ...plan,
        date: getTodayDate(),
        tasks: [...plan.tasks, ...newTasks],
        activeTaskId: plan.activeTaskId || newTasks[0].id,
      }
      await savePlan(updatedPlan)
      setGoalText('')
      setConversionHint(result.usedFallback
        ? 'Converted with fallback parsing.'
        : 'Converted with AI-assisted parsing.')

      if (!plan.activeTaskId) {
        sendMessage({ type: 'START_TIMER' }).catch(() => {})
      }
    } finally {
      setIsConverting(false)
    }
  }

  // --- Schedule mode: parse + preview + convert selected ---
  const handleParseSchedule = () => {
    const blocks = parseSchedule(goalText)
    setParsedBlocks(blocks)
    // Auto-select all block titles and items
    const selected = new Set<string>()
    for (const block of blocks) {
      if (block.title) {
        selected.add(`${block.id}:title`)
      }
      block.items.forEach((_item, idx) => {
        selected.add(`${block.id}:${idx}`)
      })
    }
    setSelectedItems(selected)
  }

  const toggleSelection = (key: string) => {
    setSelectedItems((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const convertSelectedToTasks = () => {
    const newTasks: Task[] = []
    let order = tasks.length

    for (const block of parsedBlocks) {
      const prefix = block.startTime ? `[${block.startTime}] ` : ''
      const contextTitle = block.title.trim()

      if (selectedItems.has(`${block.id}:title`) && block.title) {
        newTasks.push({
          id: generateId(),
          title: `${prefix}${block.title}`,
          completed: false,
          createdAt: Date.now(),
          order: order++,
        })
      }

      block.items.forEach((item, idx) => {
        if (selectedItems.has(`${block.id}:${idx}`)) {
          const contextualTitle = contextTitle
            ? `${prefix}${contextTitle}: ${item.text}`
            : `${prefix}${item.text}`
          newTasks.push({
            id: generateId(),
            title: contextualTitle,
            completed: false,
            createdAt: Date.now(),
            order: order++,
          })
        }
      })
    }

    if (newTasks.length === 0) return

    const updatedPlan: DailyPlan = {
      ...plan,
      date: getTodayDate(),
      tasks: [...plan.tasks, ...newTasks],
      activeTaskId: plan.activeTaskId || newTasks[0].id,
    }
    savePlan(updatedPlan)
    setParsedBlocks([])
    setSelectedItems(new Set())
    setGoalText('')

    if (!plan.activeTaskId) {
      sendMessage({ type: 'START_TIMER' }).catch(() => {})
    }
  }

  const setActiveTask = async (taskId: string) => {
    await savePlan({ ...plan, activeTaskId: taskId })
    sendMessage({ type: 'RESET_TIMER' }).catch(() => {})
  }

  const toggleTask = async (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return
    const updatedTasks = plan.tasks.map((t) =>
      t.id === taskId ? { ...t, completed: !t.completed, completedAt: !t.completed ? Date.now() : undefined } : t
    )
    let newActiveTaskId = plan.activeTaskId
    if (taskId === plan.activeTaskId && !task.completed) {
      const nextTask = updatedTasks.find((t) => !t.completed && t.id !== taskId)
      newActiveTaskId = nextTask?.id || null
    }
    await savePlan({ ...plan, tasks: updatedTasks, activeTaskId: newActiveTaskId })

    if (!newActiveTaskId) {
      sendMessage({ type: 'STOP_TIMER' }).catch(() => {})
    }
  }

  const deleteTask = async (taskId: string) => {
    const updatedTasks = plan.tasks.filter((t) => t.id !== taskId)
    let newActiveTaskId = plan.activeTaskId
    if (taskId === plan.activeTaskId) {
      const nextTask = updatedTasks.find((t) => !t.completed)
      newActiveTaskId = nextTask?.id || null
    }
    await savePlan({ ...plan, tasks: updatedTasks, activeTaskId: newActiveTaskId })

    if (!newActiveTaskId) {
      sendMessage({ type: 'STOP_TIMER' }).catch(() => {})
    }
  }

  const clearAllTasks = async () => {
    await savePlan({
      ...plan,
      tasks: [],
      activeTaskId: null,
    })
    setShowClearTasksConfirm(false)
    sendMessage({ type: 'STOP_TIMER' }).catch(() => {})
  }

  const saveEdit = async () => {
    if (!editingId || !editingTitle.trim()) return
    const updatedTasks = plan.tasks.map((t) =>
      t.id === editingId ? { ...t, title: editingTitle.trim() } : t
    )
    await savePlan({ ...plan, tasks: updatedTasks })
    setEditingId(null)
    setEditingTitle('')
  }

  const handleDragStart = (index: number) => {
    dragItem.current = index
  }

  const handleDragEnter = (index: number) => {
    dragOverItem.current = index
  }

  const handleDragEnd = async () => {
    if (dragItem.current === null || dragOverItem.current === null) return
    const reordered = [...tasks]
    const [moved] = reordered.splice(dragItem.current, 1)
    reordered.splice(dragOverItem.current, 0, moved)
    const updatedTasks = reordered.map((t, i) => ({ ...t, order: i }))
    await savePlan({ ...plan, tasks: updatedTasks })
    dragItem.current = null
    dragOverItem.current = null
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl">⚓</span>
            <h1 className="text-lg font-semibold text-slate-900">Daily Planner</h1>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => chrome.tabs.create({ url: chrome.runtime.getURL('src/pages/stats/index.html') })}
            >
              Stats
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => chrome.tabs.create({ url: chrome.runtime.getURL('src/pages/settings/index.html') })}
            >
              Settings
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Input Panel */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-semibold text-slate-900">
                {inputMode === 'quick' ? 'Quick Tasks' : 'Paste Schedule'}
              </h2>
              <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
                <button
                  onClick={() => { setInputMode('quick'); setParsedBlocks([]) }}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                    inputMode === 'quick' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Quick
                </button>
                <button
                  onClick={() => { setInputMode('schedule'); setParsedBlocks([]) }}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                    inputMode === 'schedule' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Schedule
                </button>
              </div>
            </div>
            <p className="text-sm text-slate-500 mb-4">
              {inputMode === 'quick'
                ? 'Paste messy notes or blocks. AI will try to extract usable tasks and preserve context.'
                : 'Paste a time-block schedule. We\'ll parse the structure for you.'}
            </p>
            <textarea
              value={goalText}
              onChange={(e) => setGoalText(e.target.value)}
              placeholder={
                inputMode === 'quick'
                  ? '- Write the proposal intro\n- Review client feedback\n- Send weekly report'
                  : '06:00–07:30\nUpwork showcase + task manager\n→ do 2 things ONLY:\n  1. Task manager extension\n  • make it usable\n⸻\n07:30–07:40\nWalk + lunges'
              }
              className="w-full h-64 p-4 text-sm rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none font-mono"
            />

            {inputMode === 'quick' ? (
                <Button
                  onClick={convertGoalsToTasks}
                  disabled={!goalText.trim() || isConverting}
                  className="mt-3 w-full"
                >
                  {isConverting ? 'Converting...' : 'Convert to Tasks'}
                </Button>
            ) : (
              <div className="flex gap-2 mt-3">
                <Button
                  onClick={handleParseSchedule}
                  disabled={!goalText.trim()}
                  className="flex-1"
                  variant={parsedBlocks.length > 0 ? 'secondary' : 'primary'}
                >
                  {parsedBlocks.length > 0 ? 'Re-parse' : 'Parse Schedule'}
                </Button>
                {parsedBlocks.length > 0 && (
                  <Button
                    onClick={convertSelectedToTasks}
                    disabled={selectedItems.size === 0}
                    className="flex-1"
                  >
                    Add Selected ({selectedItems.size})
                  </Button>
                )}
              </div>
            )}

            {conversionHint && inputMode === 'quick' && (
              <p className="mt-3 text-xs text-slate-500">{conversionHint}</p>
            )}

            {/* Parsed blocks preview */}
            {inputMode === 'schedule' && parsedBlocks.length > 0 && (
              <div className="mt-4 space-y-3">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Parsed Blocks ({parsedBlocks.length})
                </p>
                {parsedBlocks.map((block) => (
                  <ScheduleBlockCard
                    key={block.id}
                    block={block}
                    selectedItems={selectedItems}
                    onToggle={toggleSelection}
                  />
                ))}
              </div>
            )}
          </Card>

          {/* Right: Structured Tasks */}
          <Card className="p-6">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 mb-1">Today's Tasks</h2>
                <p className="text-sm text-slate-500">
                  {tasks.length > 0
                    ? `${tasks.filter((t) => t.completed).length} of ${tasks.length} complete. Drag to reorder.`
                    : 'No tasks yet. Use the left panel to add some.'}
                </p>
              </div>
              {tasks.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowClearTasksConfirm(true)}
                  className="shrink-0"
                >
                  Clear All
                </Button>
              )}
            </div>

            {tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-3">
                  <span className="text-2xl text-slate-400">📋</span>
                </div>
                <p className="text-sm text-slate-400">Your task list is empty</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {tasks.map((task, index) => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragEnter={() => handleDragEnter(index)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => e.preventDefault()}
                    className={`flex items-center gap-2 p-2.5 rounded-xl transition-colors group cursor-grab active:cursor-grabbing ${
                      task.id === plan.activeTaskId
                        ? 'bg-teal-50 border border-teal-100'
                        : 'hover:bg-slate-50 border border-transparent'
                    }`}
                  >
                    <span className="text-slate-300 cursor-grab text-sm select-none">⠿</span>
                    <input
                      type="checkbox"
                      checked={task.completed}
                      onChange={() => toggleTask(task.id)}
                      className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer accent-teal-600"
                    />
                    {editingId === task.id ? (
                      <input
                        type="text"
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onBlur={saveEdit}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveEdit()
                          if (e.key === 'Escape') { setEditingId(null); setEditingTitle('') }
                        }}
                        autoFocus
                        className="flex-1 text-sm px-1.5 py-0.5 border border-teal-300 rounded focus:outline-none"
                      />
                    ) : (
                      <span
                        className={`flex-1 text-sm ${
                          task.completed ? 'line-through text-slate-400' : 'text-slate-800'
                        }`}
                        onDoubleClick={() => {
                          setEditingId(task.id)
                          setEditingTitle(task.title)
                        }}
                      >
                        {task.title}
                      </span>
                    )}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!task.completed && task.id !== plan.activeTaskId && (
                        <button
                          onClick={() => setActiveTask(task.id)}
                          className="text-xs text-teal-600 hover:text-teal-800 px-1.5 py-0.5 rounded hover:bg-teal-50 cursor-pointer"
                        >
                          Focus
                        </button>
                      )}
                      {task.id === plan.activeTaskId && (
                        <span className="text-xs text-teal-600 font-medium px-1.5">Active</span>
                      )}
                      <button
                        onClick={() => deleteTask(task.id)}
                        className="text-xs text-slate-400 hover:text-red-600 px-1 cursor-pointer"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      <Modal
        open={showClearTasksConfirm}
        onClose={() => setShowClearTasksConfirm(false)}
        title="Clear all tasks?"
      >
        <p className="text-sm text-slate-600">
          This will remove every task from today&apos;s plan and stop the running timer.
        </p>
        <div className="flex gap-2 pt-3">
          <Button variant="ghost" onClick={() => setShowClearTasksConfirm(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={clearAllTasks} className="flex-1">
            Clear All Tasks
          </Button>
        </div>
      </Modal>
    </div>
  )
}

// --- Schedule Block Card Component ---

function ScheduleBlockCard({
  block,
  selectedItems,
  onToggle,
}: {
  block: ScheduleBlock
  selectedItems: Set<string>
  onToggle: (key: string) => void
}) {
  const timeLabel = block.startTime && block.endTime
    ? `${block.startTime} – ${block.endTime}`
    : null

  const titleKey = `${block.id}:title`

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      {/* Time header */}
      {timeLabel && (
        <div className="px-4 py-2 bg-slate-50 border-b border-slate-100">
          <span className="text-xs font-mono font-medium text-slate-500">{timeLabel}</span>
        </div>
      )}

      <div className="p-4 space-y-2">
        {/* Title row */}
        {block.title && (
          <label className="flex items-start gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={selectedItems.has(titleKey)}
              onChange={() => onToggle(titleKey)}
              className="w-4 h-4 mt-0.5 rounded border-slate-300 text-teal-600 accent-teal-600 cursor-pointer"
            />
            <span className="text-sm font-semibold text-slate-800 group-hover:text-teal-700">
              {block.title}
            </span>
          </label>
        )}

        {/* Tags */}
        {block.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 ml-6">
            {block.tags.map((tag, i) => (
              <span
                key={i}
                className="inline-block px-2 py-0.5 text-[11px] font-medium rounded-full bg-amber-50 text-amber-700 border border-amber-100"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Notes */}
        {block.notes.filter((n) => n.trim()).length > 0 && (
          <div className="ml-6 space-y-0.5">
            {block.notes.filter((n) => n.trim()).map((note, i) => (
              <p key={i} className="text-xs text-slate-500 italic">{note}</p>
            ))}
          </div>
        )}

        {/* Checklist items */}
        {block.items.length > 0 && (
          <div className="ml-6 space-y-1">
            {block.items.map((item, idx) => {
              const key = `${block.id}:${idx}`
              return (
                <label key={key} className="flex items-start gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={selectedItems.has(key)}
                    onChange={() => onToggle(key)}
                    className="w-3.5 h-3.5 mt-0.5 rounded border-slate-300 text-teal-600 accent-teal-600 cursor-pointer"
                  />
                  <span className="text-sm text-slate-700 group-hover:text-teal-700">{item.text}</span>
                </label>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
