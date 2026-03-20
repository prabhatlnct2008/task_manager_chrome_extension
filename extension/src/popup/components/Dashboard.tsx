import React, { useState, useMemo } from 'react'
import { useStorageValue, useStatus } from '../../shared/hooks'
import { Card } from '../../shared/components/Card'
import { Button } from '../../shared/components/Button'
import { StatusBadge } from '../../shared/components/StatusBadge'
import { ProgressBar } from '../../shared/components/ProgressBar'
import { Modal } from '../../shared/components/Modal'
import { Input } from '../../shared/components/Input'
import { ChipGroup } from '../../shared/components/Chip'
import { storage, generateId, getTodayDate } from '../../shared/lib/storage'
import { sendMessage } from '../../shared/lib/messaging'
import type { Task, DailyPlan, SideQuest } from '../../shared/types'
import { DEFAULT_DAILY_PLAN } from '../../shared/constants'

export function Dashboard() {
  const { value: dailyPlan, loading: planLoading } = useStorageValue('dailyPlan')
  const { value: sideQuests } = useStorageValue('sideQuests')
  const { status } = useStatus()

  const [showAddTask, setShowAddTask] = useState(false)
  const [showSideQuest, setShowSideQuest] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [sideQuestTitle, setSideQuestTitle] = useState('')
  const [sideQuestUrgency, setSideQuestUrgency] = useState('later')
  const [sideQuestSaved, setSideQuestSaved] = useState(false)
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')

  const plan = useMemo(() => {
    if (!dailyPlan) return DEFAULT_DAILY_PLAN
    if (dailyPlan.date !== getTodayDate()) {
      return { ...DEFAULT_DAILY_PLAN, date: getTodayDate() }
    }
    return dailyPlan
  }, [dailyPlan])

  const tasks = plan.tasks.sort((a, b) => a.order - b.order)
  const activeTask = tasks.find((t) => t.id === plan.activeTaskId)
  const completedCount = tasks.filter((t) => t.completed).length

  const savePlan = async (updated: DailyPlan) => {
    await storage.set('dailyPlan', updated)
  }

  const addTask = async () => {
    if (!newTaskTitle.trim()) return
    const task: Task = {
      id: generateId(),
      title: newTaskTitle.trim(),
      completed: false,
      createdAt: Date.now(),
      order: tasks.length,
    }
    const updatedPlan: DailyPlan = {
      ...plan,
      date: getTodayDate(),
      tasks: [...plan.tasks, task],
      activeTaskId: plan.activeTaskId || task.id,
    }
    await savePlan(updatedPlan)
    setNewTaskTitle('')
    setShowAddTask(false)

    if (!plan.activeTaskId) {
      try {
        await sendMessage({ type: 'START_TIMER' })
      } catch { /* background may not be ready */ }
    }
  }

  const toggleTask = async (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return

    const updatedTasks = plan.tasks.map((t) =>
      t.id === taskId
        ? { ...t, completed: !t.completed, completedAt: !t.completed ? Date.now() : undefined }
        : t
    )

    let newActiveTaskId = plan.activeTaskId
    if (taskId === plan.activeTaskId && !task.completed) {
      const nextTask = updatedTasks.find((t) => !t.completed && t.id !== taskId)
      newActiveTaskId = nextTask?.id || null
    }

    await savePlan({ ...plan, tasks: updatedTasks, activeTaskId: newActiveTaskId })

    if (!newActiveTaskId) {
      try {
        await sendMessage({ type: 'STOP_TIMER' })
      } catch { /* ok */ }
    }
  }

  const setActiveTask = async (taskId: string) => {
    await savePlan({ ...plan, activeTaskId: taskId })
    try {
      await sendMessage({ type: 'RESET_TIMER' })
    } catch { /* ok */ }
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

  const saveEditTask = async () => {
    if (!editingTaskId || !editingTitle.trim()) return
    const updatedTasks = plan.tasks.map((t) =>
      t.id === editingTaskId ? { ...t, title: editingTitle.trim() } : t
    )
    await savePlan({ ...plan, tasks: updatedTasks })
    setEditingTaskId(null)
    setEditingTitle('')
  }

  const saveSideQuest = async () => {
    if (!sideQuestTitle.trim()) return
    const quest: SideQuest = {
      id: generateId(),
      title: sideQuestTitle.trim(),
      urgency: sideQuestUrgency as 'later' | 'today' | 'urgent',
      createdAt: Date.now(),
      completed: false,
    }
    const current = sideQuests || []
    await storage.set('sideQuests', [...current, quest])
    setSideQuestSaved(true)
    setTimeout(() => {
      setSideQuestSaved(false)
      setSideQuestTitle('')
      setSideQuestUrgency('later')
      setShowSideQuest(false)
    }, 2000)
  }

  const getStatusType = (): 'focus' | 'idle' | 'awaiting' => {
    if (!activeTask) return 'idle'
    if (status?.timerRunning) return 'focus'
    return 'awaiting'
  }

  const formatCountdown = () => {
    if (!status?.nextCheckinTime) return null
    const remaining = Math.max(0, status.nextCheckinTime - Date.now())
    const minutes = Math.floor(remaining / 60000)
    const seconds = Math.floor((remaining % 60000) / 1000)
    if (minutes > 0) return `${minutes}m ${seconds}s`
    return `${seconds}s`
  }

  if (planLoading) {
    return (
      <div className="w-[380px] min-h-[500px] flex items-center justify-center bg-slate-50">
        <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="w-[380px] min-h-[500px] bg-slate-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-100">
        <div className="flex items-center gap-2">
          <span className="text-base">⚓</span>
          <span className="font-semibold text-slate-900 text-sm">AnchorFlow</span>
        </div>
        <StatusBadge status={getStatusType()} />
      </div>

      <div className="flex-1 p-4 space-y-3 overflow-y-auto">
        {/* Current Focus Card */}
        <Card className="p-4">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
            Current Focus
          </p>
          {activeTask ? (
            <div>
              <p className="text-base font-semibold text-slate-900">{activeTask.title}</p>
              <p className="text-xs text-slate-400 mt-1">
                Started {Math.round((Date.now() - activeTask.createdAt) / 60000)} min ago
              </p>
            </div>
          ) : (
            <p className="text-sm text-slate-400">No active task. Add one to get started.</p>
          )}
        </Card>

        {/* Task List */}
        {tasks.length > 0 && (
          <Card className="p-4">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
              Today's Tasks
            </p>
            <div className="space-y-1">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className={`flex items-center gap-2 p-2 rounded-xl transition-colors group ${
                    task.id === plan.activeTaskId
                      ? 'bg-teal-50 border border-teal-100'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={task.completed}
                    onChange={() => toggleTask(task.id)}
                    className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer accent-teal-600"
                  />
                  {editingTaskId === task.id ? (
                    <input
                      type="text"
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onBlur={saveEditTask}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEditTask()
                        if (e.key === 'Escape') { setEditingTaskId(null); setEditingTitle('') }
                      }}
                      autoFocus
                      className="flex-1 text-sm px-1 py-0.5 border border-teal-300 rounded focus:outline-none"
                    />
                  ) : (
                    <span
                      className={`flex-1 text-sm cursor-pointer ${
                        task.completed ? 'line-through text-slate-400' : 'text-slate-800'
                      }`}
                      onDoubleClick={() => {
                        setEditingTaskId(task.id)
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
                        title="Set as active"
                      >
                        Focus
                      </button>
                    )}
                    <button
                      onClick={() => deleteTask(task.id)}
                      className="text-xs text-slate-400 hover:text-red-600 px-1 py-0.5 cursor-pointer"
                      title="Delete task"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Progress */}
        {tasks.length > 0 && (
          <Card className="p-4">
            <ProgressBar value={completedCount} max={tasks.length} label="Today's Progress" />
          </Card>
        )}

        {/* Check-in Countdown */}
        {status?.timerRunning && (
          <Card className="p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-teal-50 flex items-center justify-center shrink-0">
              <span className="text-teal-600 text-sm">⏱</span>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700">
                Next check-in in {formatCountdown() || '...'}
              </p>
            </div>
          </Card>
        )}

        {/* Quick Actions */}
        <div className="flex gap-2">
          <Button variant="primary" size="sm" onClick={() => setShowAddTask(true)} className="flex-1">
            + Add Task
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setShowSideQuest(true)} className="flex-1">
            Side Quest
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => chrome.tabs.create({ url: chrome.runtime.getURL('src/pages/planner/index.html') })}
          >
            Planner
          </Button>
        </div>
      </div>

      {/* Add Task Modal */}
      <Modal open={showAddTask} onClose={() => setShowAddTask(false)} title="Add Task">
        <Input
          label="Task"
          value={newTaskTitle}
          onChange={setNewTaskTitle}
          placeholder="What do you need to do?"
        />
        <div className="flex gap-2 pt-2">
          <Button variant="ghost" onClick={() => setShowAddTask(false)}>
            Cancel
          </Button>
          <Button onClick={addTask} className="flex-1" disabled={!newTaskTitle.trim()}>
            Add
          </Button>
        </div>
      </Modal>

      {/* Side Quest Modal */}
      <Modal
        open={showSideQuest}
        onClose={() => {
          setShowSideQuest(false)
          setSideQuestSaved(false)
          setSideQuestTitle('')
        }}
        title="What just came up?"
      >
        {sideQuestSaved ? (
          <div className="text-center py-4 space-y-2">
            <p className="text-teal-600 font-medium">Saved.</p>
            {activeTask && (
              <p className="text-sm text-slate-600">
                Go back to: <span className="font-medium">{activeTask.title}</span>
              </p>
            )}
          </div>
        ) : (
          <>
            <Input
              value={sideQuestTitle}
              onChange={setSideQuestTitle}
              placeholder="Quick thought or task..."
            />
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-500">When?</label>
              <ChipGroup
                options={[
                  { value: 'later', label: 'Later' },
                  { value: 'today', label: 'Today' },
                  { value: 'urgent', label: 'Urgent' },
                ]}
                value={sideQuestUrgency}
                onChange={setSideQuestUrgency}
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="ghost" onClick={() => setShowSideQuest(false)}>
                Cancel
              </Button>
              <Button onClick={saveSideQuest} className="flex-1" disabled={!sideQuestTitle.trim()}>
                Save
              </Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}
