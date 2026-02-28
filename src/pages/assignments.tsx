import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase/client'
import { useAssignments } from '../hooks/useAssignments'
import { useCourses } from '../hooks/useCourses'
import AssignmentCard from '../components/dashboard/AssignmentCard'
import Navbar from '../components/Navbar'

export default function AssignmentsPage() {
  const [authed, setAuthed] = useState(false)
  const [courseFilter, setCourseFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const navigate = useNavigate()
  const { courses } = useCourses()
  const { assignments, loading, updateStatus } = useAssignments({
    course_id: courseFilter || undefined,
    status: statusFilter || undefined,
  })

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) navigate('/login')
      else setAuthed(true)
    })
  }, [navigate])

  if (!authed) return null

  const selectStyle: React.CSSProperties = {
    fontFamily: 'var(--font-mono)',
    fontSize: '10px',
    letterSpacing: '0.1em',
    background: 'var(--bg-surface)',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border-default)',
    padding: '7px 10px',
    outline: 'none',
    cursor: 'pointer',
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <div className="hud-grid-bg" />
      <Navbar />

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '32px 24px', position: 'relative', zIndex: 1 }}>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '9px',
          color: 'var(--accent-cyan)',
          letterSpacing: '0.16em',
          marginBottom: '8px',
        }}>
          // ASSIGNMENT REGISTRY
        </div>
        <div style={{
          fontFamily: 'var(--font-display)',
          fontSize: '20px',
          fontWeight: 700,
          color: 'var(--text-primary)',
          letterSpacing: '0.1em',
          marginBottom: '20px',
        }}>
          ALL ASSIGNMENTS
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <select value={courseFilter} onChange={e => setCourseFilter(e.target.value)} style={selectStyle}>
            <option value="">ALL COURSES</option>
            {courses.map(c => (
              <option key={c.id} value={c.id}>{(c.short_name || c.name).toUpperCase()}</option>
            ))}
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={selectStyle}>
            <option value="">ALL STATUS</option>
            <option value="pending">PENDING</option>
            <option value="submitted">SUBMITTED</option>
            <option value="graded">GRADED</option>
          </select>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {[...Array(6)].map((_, i) => (
              <div key={i} className="hud-panel animate-in" style={{ height: '70px', animationDelay: `${i * 0.05}s`, opacity: 0 }}>
                <span className="hud-corner-tr" /><span className="hud-corner-bl" />
              </div>
            ))}
          </div>
        ) : assignments.length === 0 ? (
          <div className="hud-panel" style={{ padding: '32px', textAlign: 'center' }}>
            <span className="hud-corner-tr" /><span className="hud-corner-bl" />
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-dim)' }}>
              NO TARGETS FOUND
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {assignments.map((a, i) => (
              <div key={a.id} className="animate-in" style={{ animationDelay: `${i * 0.03}s`, opacity: 0 }}>
                <AssignmentCard assignment={a} onStatusToggle={updateStatus} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
