import { useMemo } from 'react'
import { format, isToday, isTomorrow, isThisWeek, isPast, parseISO, addDays, startOfDay } from 'date-fns'
import { useAssignments } from '../../hooks/useAssignments'
import AssignmentCard from './AssignmentCard'

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function TodayView({ firstName }: { firstName?: string }) {
  const nextWeek = format(addDays(new Date(), 7), 'yyyy-MM-dd')

  const { assignments, loading, updateStatus } = useAssignments({
    due_after: format(addDays(new Date(), -30), 'yyyy-MM-dd'),
    due_before: nextWeek,
  })

  const grouped = useMemo(() => {
    const overdue: typeof assignments = []
    const dueToday: typeof assignments = []
    const dueTomorrow: typeof assignments = []
    const thisWeek: typeof assignments = []

    for (const a of assignments) {
      if (!a.due_date || a.status === 'archived') continue
      const d = parseISO(a.due_date)
      if (isPast(startOfDay(d)) && !isToday(d) && a.status === 'pending') overdue.push(a)
      else if (isToday(d)) dueToday.push(a)
      else if (isTomorrow(d)) dueTomorrow.push(a)
      else if (isThisWeek(d)) thisWeek.push(a)
    }

    return { overdue, dueToday, dueTomorrow, thisWeek }
  }, [assignments])

  if (loading) {
    return <div className="animate-pulse space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-xl" />)}</div>
  }

  const total = grouped.overdue.length + grouped.dueToday.length + grouped.dueTomorrow.length + grouped.thisWeek.length

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {getGreeting()}{firstName ? `, ${firstName}` : ''}.
        </h1>
        <p className="text-gray-500">{format(new Date(), 'EEEE, MMMM d')}</p>
      </div>

      {total === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">🎉</p>
          <p className="text-gray-500">You're all caught up!</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.overdue.length > 0 && (
            <Section title="Overdue" color="text-red-600" assignments={grouped.overdue} onStatusToggle={updateStatus} />
          )}
          {grouped.dueToday.length > 0 && (
            <Section title="Due Today" color="text-[#821C24]" assignments={grouped.dueToday} onStatusToggle={updateStatus} />
          )}
          {grouped.dueTomorrow.length > 0 && (
            <Section title="Tomorrow" assignments={grouped.dueTomorrow} onStatusToggle={updateStatus} />
          )}
          {grouped.thisWeek.length > 0 && (
            <Section title="This Week" assignments={grouped.thisWeek} onStatusToggle={updateStatus} />
          )}
        </div>
      )}
    </div>
  )
}

function Section({ title, color = 'text-gray-700', assignments, onStatusToggle }: {
  title: string
  color?: string
  assignments: ReturnType<typeof useAssignments>['assignments']
  onStatusToggle: ReturnType<typeof useAssignments>['updateStatus']
}) {
  return (
    <div>
      <h2 className={`text-sm font-semibold uppercase tracking-wide mb-2 ${color}`}>{title}</h2>
      <div className="space-y-2">
        {assignments.map((a) => (
          <AssignmentCard key={a.id} assignment={a} onStatusToggle={(id, status) => onStatusToggle(id, status)} />
        ))}
      </div>
    </div>
  )
}
