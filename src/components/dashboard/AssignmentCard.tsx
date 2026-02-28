import { differenceInCalendarDays, parseISO, startOfDay } from 'date-fns'
import type { Assignment } from '../../types'
import { courseLabel } from '../../lib/courseLabel'

const PLATFORM_LABELS: Record<string, string> = {
  gradescope: 'GRADESCOPE',
  moodle: 'MOODLE',
  'in-class': 'IN-CLASS',
  unknown: 'TBD',
}

const TYPE_COLORS: Record<string, string> = {
  exam:     'var(--accent-red)',
  project:  '#B47EFF',
  homework: 'var(--accent-cyan)',
  quiz:     'var(--accent-amber)',
  reading:  'var(--accent-green)',
  other:    'var(--text-dim)',
}

function formatDueDate(dueDate: string): { text: string; color: string } {
  const days = differenceInCalendarDays(parseISO(dueDate), startOfDay(new Date()))
  if (days < 0)  return { text: `T+${Math.abs(days).toString().padStart(2, '0')} DAYS`, color: 'var(--accent-red)' }
  if (days === 0) return { text: 'T-00 // TODAY',    color: 'var(--accent-amber)' }
  if (days === 1) return { text: 'T-01 // TOMORROW', color: 'var(--accent-amber)' }
  return { text: `T-${days.toString().padStart(2, '0')} DAYS`, color: 'var(--text-secondary)' }
}

interface Props {
  assignment: Assignment
  onStatusToggle?: (id: string, status: Assignment['status']) => void
}

export default function AssignmentCard({ assignment, onStatusToggle }: Props) {
  const isDone = assignment.status === 'submitted' || assignment.status === 'graded'
  const dueInfo = assignment.due_date ? formatDueDate(assignment.due_date) : null
  const courseColor = assignment.course?.color || 'var(--accent-cyan)'
  const typeColor = TYPE_COLORS[assignment.type] || 'var(--text-dim)'

  return (
    <div
      className="hud-panel"
      style={{
        display: 'flex',
        alignItems: 'stretch',
        overflow: 'hidden',
        opacity: isDone ? 0.45 : 1,
        transition: 'opacity 0.3s ease, border-color 0.25s ease, box-shadow 0.25s ease',
      }}
    >
      <span className="hud-corner-tr" />
      <span className="hud-corner-bl" />

      {/* Left accent bar */}
      <div style={{
        width: '3px',
        background: isDone ? 'var(--text-dim)' : courseColor,
        flexShrink: 0,
        transition: 'background 0.3s ease',
        boxShadow: isDone ? 'none' : `0 0 8px ${courseColor}55`,
      }} />

      {/* Content — entire area is clickable if there's a URL */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center' }}>
        {/* Hex status toggle — stops propagation so it doesn't also open the link */}
        <div style={{ padding: '12px 0 12px 14px', flexShrink: 0 }}>
          <button
            onClick={e => { e.stopPropagation(); onStatusToggle?.(assignment.id, isDone ? 'pending' : 'submitted') }}
            style={{
              width: '20px', height: '20px',
              clipPath: 'polygon(50% 0%, 95% 25%, 95% 75%, 50% 100%, 5% 75%, 5% 25%)',
              background: isDone ? 'var(--accent-green)' : 'rgba(0, 212, 255, 0.12)',
              border: 'none', cursor: 'pointer', flexShrink: 0,
              transition: 'background 0.2s ease, box-shadow 0.2s ease',
              boxShadow: isDone ? '0 0 10px rgba(0,255,157,0.5)' : 'none',
            }}
            onMouseEnter={e => { if (!isDone) (e.currentTarget as HTMLElement).style.background = 'rgba(0, 212, 255, 0.25)' }}
            onMouseLeave={e => { if (!isDone) (e.currentTarget as HTMLElement).style.background = 'rgba(0, 212, 255, 0.12)' }}
          />
        </div>

        {/* Clickable content area */}
        {assignment.external_url ? (
          <a
            href={assignment.external_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', textDecoration: 'none' }}
          >
            <CardBody assignment={assignment} isDone={isDone} courseColor={courseColor} typeColor={typeColor} dueInfo={dueInfo} />
          </a>
        ) : (
          <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px' }}>
            <CardBody assignment={assignment} isDone={isDone} courseColor={courseColor} typeColor={typeColor} dueInfo={dueInfo} />
          </div>
        )}
      </div>
    </div>
  )
}

function CardBody({ assignment, isDone, courseColor, typeColor, dueInfo }: {
  assignment: Assignment
  isDone: boolean
  courseColor: string
  typeColor: string
  dueInfo: { text: string; color: string } | null
}) {
  return (
    <>
      {/* Text content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {assignment.course && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.14em', color: isDone ? 'var(--text-dim)' : courseColor, textTransform: 'uppercase', marginBottom: '3px', textShadow: isDone ? 'none' : `0 0 6px ${courseColor}66` }}>
            {courseLabel(assignment.course.name, assignment.course.short_name)}
          </div>
        )}
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '12px', fontWeight: 500, color: isDone ? 'var(--text-dim)' : 'var(--text-primary)', letterSpacing: '0.05em', textDecoration: isDone ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {assignment.title}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.1em', color: 'var(--text-dim)', border: '1px solid var(--border-default)', padding: '1px 5px' }}>
            {PLATFORM_LABELS[assignment.platform]}
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.1em', color: typeColor, textTransform: 'uppercase' }}>
            {assignment.type}
          </span>
          {assignment.points != null && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-dim)', letterSpacing: '0.08em' }}>
              [ {assignment.points} PTS ]
            </span>
          )}
          {assignment.parse_confidence === 'low' && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--accent-amber)', letterSpacing: '0.08em' }}>⚠ UNVERIFIED</span>
          )}
        </div>
      </div>

      {/* Due date */}
      {dueInfo && (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.1em', color: isDone ? 'var(--text-dim)' : dueInfo.color, flexShrink: 0, textAlign: 'right', textShadow: isDone ? 'none' : `0 0 6px ${dueInfo.color}55` }}>
          {dueInfo.text}
          {assignment.due_time && (
            <div style={{ fontSize: '9px', marginTop: '2px', color: 'var(--text-dim)' }}>{assignment.due_time}</div>
          )}
        </div>
      )}
    </>
  )
}
