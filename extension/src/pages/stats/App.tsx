import React, { useState, useMemo } from 'react'
import { useStorageValue } from '../../shared/hooks'
import { Card } from '../../shared/components/Card'
import { Button } from '../../shared/components/Button'
import { ChipGroup } from '../../shared/components/Chip'
import type { CheckinRecord } from '../../shared/types'

type DateRange = 'today' | '7days' | '30days'

export function StatsApp() {
  const { value: checkinHistory, loading: historyLoading } = useStorageValue('checkinHistory')
  const { value: sideQuests } = useStorageValue('sideQuests')
  const { value: dailyPlan } = useStorageValue('dailyPlan')
  const [dateRange, setDateRange] = useState<DateRange>('7days')

  const filteredCheckins = useMemo(() => {
    if (!checkinHistory) return []
    const now = Date.now()
    const ranges: Record<DateRange, number> = {
      today: 24 * 60 * 60 * 1000,
      '7days': 7 * 24 * 60 * 60 * 1000,
      '30days': 30 * 24 * 60 * 60 * 1000,
    }
    const cutoff = now - ranges[dateRange]
    return checkinHistory.filter((c) => c.timestamp >= cutoff)
  }, [checkinHistory, dateRange])

  const stats = useMemo(() => {
    const totalCheckins = filteredCheckins.length
    const aligned = filteredCheckins.filter((c) => c.classification === 'aligned').length
    const offTrack = filteredCheckins.filter(
      (c) => c.classification === 'off_track' || c.classification === 'slightly_off'
    ).length
    const alignmentRate = totalCheckins > 0 ? Math.round((aligned / totalCheckins) * 100) : 0

    const tasks = dailyPlan?.tasks || []
    const totalTasks = tasks.length
    const completedTasks = tasks.filter((t) => t.completed).length
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

    const allSideQuests = sideQuests || []
    const totalSideQuests = allSideQuests.length
    const completedSideQuests = allSideQuests.filter((s) => s.completed).length
    const pendingSideQuests = totalSideQuests - completedSideQuests

    const returnActions = filteredCheckins.filter(
      (c) => c.actionTaken === 'return' || c.actionTaken === 'continue'
    ).length

    return {
      totalCheckins,
      aligned,
      offTrack,
      alignmentRate,
      totalTasks,
      completedTasks,
      completionRate,
      totalSideQuests,
      completedSideQuests,
      pendingSideQuests,
      returnActions,
    }
  }, [filteredCheckins, dailyPlan, sideQuests])

  // Group checkins by day for the trend
  const dailyTrend = useMemo(() => {
    const byDay: Record<string, { aligned: number; offTrack: number; total: number }> = {}
    filteredCheckins.forEach((c) => {
      const day = new Date(c.timestamp).toISOString().split('T')[0]
      if (!byDay[day]) byDay[day] = { aligned: 0, offTrack: 0, total: 0 }
      byDay[day].total++
      if (c.classification === 'aligned') byDay[day].aligned++
      if (c.classification === 'off_track' || c.classification === 'slightly_off') byDay[day].offTrack++
    })
    return Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({ date, ...data }))
  }, [filteredCheckins])

  if (historyLoading) {
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
          <div>
            <div className="flex items-center gap-3">
              <span className="text-xl">⚓</span>
              <h1 className="text-lg font-semibold text-slate-900">Focus Stats</h1>
            </div>
            <p className="text-sm text-slate-500 mt-1">A view of how your work patterns are evolving.</p>
          </div>
          <ChipGroup
            options={[
              { value: 'today', label: 'Today' },
              { value: '7days', label: '7 Days' },
              { value: '30days', label: '30 Days' },
            ]}
            value={dateRange}
            onChange={(v) => setDateRange(v as DateRange)}
          />
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Task Completion"
            value={`${stats.completionRate}%`}
            detail={`${stats.completedTasks} of ${stats.totalTasks} tasks finished`}
            color="teal"
          />
          <StatCard
            title="Focus Alignment"
            value={`${stats.alignmentRate}%`}
            detail={`Aligned during ${stats.aligned} of ${stats.totalCheckins} check-ins`}
            color="blue"
          />
          <StatCard
            title="Side Quests"
            value={String(stats.totalSideQuests)}
            detail={`${stats.completedSideQuests} completed, ${stats.pendingSideQuests} pending`}
            color="amber"
          />
          <StatCard
            title="Successful Returns"
            value={String(stats.returnActions)}
            detail={`Times you returned to focus after check-in`}
            color="green"
          />
        </div>

        {/* Alignment Trend */}
        {dailyTrend.length > 0 && (
          <Card className="p-6">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Daily Focus Alignment</h3>
            <div className="space-y-2">
              {dailyTrend.map((day) => (
                <div key={day.date} className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 w-20 shrink-0">
                    {new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                  <div className="flex-1 flex gap-1 h-6">
                    {day.aligned > 0 && (
                      <div
                        className="bg-teal-400 rounded"
                        style={{ width: `${(day.aligned / day.total) * 100}%` }}
                        title={`${day.aligned} aligned`}
                      />
                    )}
                    {day.offTrack > 0 && (
                      <div
                        className="bg-amber-300 rounded"
                        style={{ width: `${(day.offTrack / day.total) * 100}%` }}
                        title={`${day.offTrack} off track`}
                      />
                    )}
                    {day.total - day.aligned - day.offTrack > 0 && (
                      <div
                        className="bg-slate-200 rounded"
                        style={{ width: `${((day.total - day.aligned - day.offTrack) / day.total) * 100}%` }}
                        title={`${day.total - day.aligned - day.offTrack} other`}
                      />
                    )}
                  </div>
                  <span className="text-xs text-slate-400 w-10 text-right">{day.total}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-4 mt-4 text-xs text-slate-500">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-teal-400 rounded" /> Aligned</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-amber-300 rounded" /> Off Track</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-slate-200 rounded" /> Other</span>
            </div>
          </Card>
        )}

        {/* Check-in History Table */}
        <Card className="p-6">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Check-in History</h3>
          {filteredCheckins.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-slate-400">No check-ins recorded yet for this period.</p>
              <p className="text-xs text-slate-400 mt-1">Check-ins will appear here after your first focus session.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left py-2 px-2 text-xs font-medium text-slate-500">Time</th>
                    <th className="text-left py-2 px-2 text-xs font-medium text-slate-500">Task</th>
                    <th className="text-left py-2 px-2 text-xs font-medium text-slate-500">Response</th>
                    <th className="text-left py-2 px-2 text-xs font-medium text-slate-500">Status</th>
                    <th className="text-left py-2 px-2 text-xs font-medium text-slate-500">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {[...filteredCheckins].reverse().slice(0, 50).map((checkin) => (
                    <tr key={checkin.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="py-2 px-2 text-xs text-slate-500 whitespace-nowrap">
                        {new Date(checkin.timestamp).toLocaleString('en-US', {
                          month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                        })}
                      </td>
                      <td className="py-2 px-2 text-slate-800 max-w-[200px] truncate">{checkin.activeTaskTitle}</td>
                      <td className="py-2 px-2 text-slate-600 max-w-[200px] truncate">{checkin.userResponse}</td>
                      <td className="py-2 px-2">
                        <ClassificationBadge classification={checkin.classification} />
                      </td>
                      <td className="py-2 px-2 text-xs text-slate-500 capitalize">
                        {checkin.actionTaken.replace('_', ' ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

function StatCard({
  title,
  value,
  detail,
  color,
}: {
  title: string
  value: string
  detail: string
  color: string
}) {
  const colorStyles: Record<string, string> = {
    teal: 'bg-teal-50 text-teal-700',
    blue: 'bg-blue-50 text-blue-700',
    amber: 'bg-amber-50 text-amber-700',
    green: 'bg-emerald-50 text-emerald-700',
  }
  return (
    <Card className="p-5">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">{title}</p>
      <p className={`text-3xl font-bold ${colorStyles[color]?.split(' ')[1] || 'text-slate-900'}`}>
        {value}
      </p>
      <p className="text-xs text-slate-500 mt-1">{detail}</p>
    </Card>
  )
}

function ClassificationBadge({ classification }: { classification: string }) {
  const styles: Record<string, string> = {
    aligned: 'bg-teal-50 text-teal-700',
    slightly_off: 'bg-amber-50 text-amber-700',
    off_track: 'bg-red-50 text-red-700',
    break: 'bg-slate-100 text-slate-600',
    urgent: 'bg-blue-50 text-blue-700',
  }
  return (
    <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${styles[classification] || 'bg-slate-100 text-slate-600'}`}>
      {classification.replace('_', ' ')}
    </span>
  )
}
