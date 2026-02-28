import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase/client'
import Navbar from '../components/Navbar'
import Briefing from '../components/dashboard/Briefing'
import AssignmentCard from '../components/dashboard/AssignmentCard'
import PortalLinks from '../components/dashboard/PortalLinks'
import CourseStatus from '../components/dashboard/CourseStatus'
import { useAssignments } from '../hooks/useAssignments'
import { isPast, isToday, isTomorrow, isThisWeek, parseISO, startOfDay, addDays, format } from 'date-fns'
import type { User } from '../types'

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null)
  const navigate = useNavigate()

  const { assignments, loading, updateStatus } = useAssignments({
    due_after: format(addDays(new Date(), -60), 'yyyy-MM-dd'),
    due_before: format(addDays(new Date(), 90), 'yyyy-MM-dd'),
  })

  useEffect(() => {
    async function loadUser() {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) { navigate('/login'); return }
      const { data } = await supabase.from('users').select('*').eq('id', authUser.id).single()
      if (!data?.onboarding_complete) { navigate('/onboarding'); return }
      setUser(data)
    }
    loadUser()
  }, [navigate])

  const firstName = user?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'OPERATOR'

  const overdue     = assignments.filter(a => a.due_date && isPast(startOfDay(parseISO(a.due_date))) && !isToday(parseISO(a.due_date)) && a.status === 'pending')
  const dueToday    = assignments.filter(a => a.due_date && isToday(parseISO(a.due_date)))
  const dueTomorrow = assignments.filter(a => a.due_date && isTomorrow(parseISO(a.due_date)))
  const thisWeek    = assignments.filter(a => a.due_date && isThisWeek(parseISO(a.due_date), { weekStartsOn: 1 }) && !isToday(parseISO(a.due_date)) && !isTomorrow(parseISO(a.due_date)))
  const upcoming    = assignments.filter(a => a.due_date && !isPast(parseISO(a.due_date)) && !isThisWeek(parseISO(a.due_date), { weekStartsOn: 1 }) && a.status === 'pending')
  const allEmpty    = overdue.length + dueToday.length + dueTomorrow.length + thisWeek.length + upcoming.length === 0

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <div className="hud-grid-bg" />
      <Navbar />

      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '28px 24px',
        display: 'grid',
        gridTemplateColumns: '1fr 260px',
        gap: '20px',
        position: 'relative',
        zIndex: 1,
      }}>
        {/* Main column */}
        <main>
          {!loading && (
            <Briefing assignments={assignments} firstName={firstName} />
          )}

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[...Array(5)].map((_, i) => (
                <div key={i} className="hud-panel animate-in" style={{
                  height: '70px',
                  animationDelay: `${i * 0.06}s`,
                  opacity: 0,
                }}>
                  <span className="hud-corner-tr" />
                  <span className="hud-corner-bl" />
                </div>
              ))}
            </div>
          ) : allEmpty ? (
            <div className="hud-panel animate-in delay-2" style={{ padding: '32px', textAlign: 'center' }}>
              <span className="hud-corner-tr" />
              <span className="hud-corner-bl" />
              <div style={{
                fontFamily: 'var(--font-display)',
                fontSize: '12px',
                color: 'var(--accent-green)',
                letterSpacing: '0.12em',
                marginBottom: '8px',
              }}>
                // CLEAR HORIZON
              </div>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                color: 'var(--text-dim)',
              }}>
                No active targets in range. Stand by.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {overdue.length > 0     && <Section label="// OVERDUE"    accent="var(--accent-red)"     items={overdue}     onToggle={updateStatus} delay={1} />}
              {dueToday.length > 0    && <Section label="// DUE TODAY"  accent="var(--accent-amber)"   items={dueToday}    onToggle={updateStatus} delay={2} />}
              {dueTomorrow.length > 0 && <Section label="// TOMORROW"   accent="var(--accent-cyan)"    items={dueTomorrow} onToggle={updateStatus} delay={3} />}
              {thisWeek.length > 0    && <Section label="// THIS WEEK"  accent="var(--text-secondary)" items={thisWeek}    onToggle={updateStatus} delay={4} />}
              {upcoming.length > 0    && <Section label="// UPCOMING"   accent="var(--text-dim)"       items={upcoming}    onToggle={updateStatus} delay={5} />}
            </div>
          )}
        </main>

        {/* Sidebar */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="animate-in delay-2"><PortalLinks /></div>
          <div className="animate-in delay-3"><CourseStatus /></div>
        </aside>
      </div>
    </div>
  )
}

function Section({
  label, accent, items, onToggle, delay,
}: {
  label: string
  accent: string
  items: ReturnType<typeof useAssignments>['assignments']
  onToggle: ReturnType<typeof useAssignments>['updateStatus']
  delay: number
}) {
  return (
    <div className={`animate-in delay-${delay}`} style={{ opacity: 0 }}>
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '10px',
        letterSpacing: '0.16em',
        color: accent,
        marginBottom: '8px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        textShadow: `0 0 6px ${accent}55`,
      }}>
        {label}
        <span style={{
          display: 'inline-block',
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: accent,
          boxShadow: `0 0 6px ${accent}`,
          opacity: 0.7,
        }} />
        <span style={{ color: 'var(--text-dim)', textShadow: 'none' }}>
          [ {String(items.length).padStart(2, '0')} ]
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {items.map(a => (
          <AssignmentCard
            key={a.id}
            assignment={a}
            onStatusToggle={(id, status) => onToggle(id, status)}
          />
        ))}
      </div>
    </div>
  )
}
