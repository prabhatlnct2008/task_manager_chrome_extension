import React, { useState, useMemo, useRef } from 'react'
import { useStorageValue } from '../../shared/hooks'
import { Card } from '../../shared/components/Card'
import { Button } from '../../shared/components/Button'
import { storage, generateId, getTodayDate } from '../../shared/lib/storage'
import { sendMessage } from '../../shared/lib/messaging'
import type { Task, DailyPlan } from '../../shared/types'
import { DEFAULT_DAILY_PLAN } from '../../shared/constants'

export function PlannerApp() {
  const { value: dailyPlan, loading } = useStorageValue('dailyPlan')
  const [goalText, setGoalText] = useState('')
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

  const convertGoalsToTasks = () => {
    const lines = goalText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
    if (lines.length === 0) return

    const newTasks: Task[] = lines.map((line, i) => ({
      id: generateId(),
      title: line.replace(/^[-•*]\s*/, ''),
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
    savePlan(updatedPlan)
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
  }

  const deleteTask = async (taskId: string) => {
    const updatedTasks = plan.tasks.filter((t) => t.id !== taskId)
    let newActiveTaskId = plan.activeTaskId
    if (taskId === plan.activeTaskId) {
      const nextTask = updatedTasks.find((t) => !t.completed)
      newActiveTaskId = nextTask?.id || null
    }
    await savePlan({ ...plan, tasks: updatedTasks, activeTaskId: newActiveTaskId })
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
          {/* Left: Goal Dump */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-1">What needs to happen today?</h2>
            <p className="text-sm text-slate-500 mb-4">
              Dump your raw thoughts. One task per line. Click convert to add them to your plan.
            </p>
            <textarea
              value={goalText}
              onChange={(e) => setGoalText(e.target.value)}
              placeholder="- Write the proposal intro&#10;- Review client feedback&#10;- Send weekly report&#10;- Fix the login bug"
              className="w-full h-64 p-4 text-sm rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
            />
            <Button
              onClick={convertGoalsToTasks}
              disabled={!goalText.trim()}
              className="mt-3 w-full"
            >
              Convert to Tasks
            </Button>
          </Card>

          {/* Right: Structured Tasks */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-1">Today's Tasks</h2>
            <p className="text-sm text-slate-500 mb-4">
              {tasks.length > 0
                ? `${tasks.filter((t) => t.completed).length} of ${tasks.length} complete. Drag to reorder.`
                : 'No tasks yet. Use the left panel to add some.'}
            </p>

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
    </div>
  )
}
