import { useCourses } from '../../hooks/useCourses'
import { courseLabel, moodleCourseUrl } from '../../lib/courseLabel'

export default function CourseStatus() {
  const { courses, loading } = useCourses()

  return (
    <div className="hud-panel" style={{ padding: '16px' }}>
      <span className="hud-corner-tr" />
      <span className="hud-corner-bl" />

      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '9px',
        color: 'var(--accent-cyan)',
        letterSpacing: '0.16em',
        marginBottom: '12px',
        textTransform: 'uppercase',
      }}>
        // COURSE SYNC STATUS
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} style={{
              height: '2px',
              background: 'var(--border-default)',
              borderRadius: '1px',
              width: `${60 + i * 10}%`,
            }} />
          ))}
        </div>
      ) : courses.length === 0 ? (
        <p style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '10px',
          color: 'var(--text-dim)',
          fontStyle: 'italic',
        }}>
          NO COURSES LOADED
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {courses.map((course, i) => {
            const label = courseLabel(course.name, course.short_name)
            return (
              <div
                key={course.id}
                className="animate-in"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  animationDelay: `${i * 0.04}s`,
                }}
              >
                {/* Course name */}
                <a
                  href={moodleCourseUrl(course.moodle_course_id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '9px',
                    color: 'var(--text-secondary)',
                    letterSpacing: '0.06em',
                    flexShrink: 0,
                    minWidth: '72px',
                    textDecoration: 'none',
                    transition: 'color 0.2s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent-cyan)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
                >
                  {label}
                </a>

                {/* Dot fill */}
                <span style={{
                  flex: 1,
                  fontFamily: 'var(--font-mono)',
                  fontSize: '9px',
                  color: 'var(--text-dim)',
                  overflow: 'hidden',
                  letterSpacing: '0.04em',
                  whiteSpace: 'nowrap',
                }}>
                  {'·'.repeat(20)}
                </span>

                {/* Status badge */}
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '8px',
                  letterSpacing: '0.1em',
                  color: course.syllabus_parsed
                    ? 'var(--accent-green)'
                    : 'var(--accent-amber)',
                  border: `1px solid ${course.syllabus_parsed ? 'rgba(0,255,157,0.3)' : 'rgba(255,179,71,0.3)'}`,
                  padding: '1px 4px',
                  flexShrink: 0,
                }}>
                  {course.syllabus_parsed ? 'PARSED' : 'PENDING'}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
