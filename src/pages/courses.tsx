import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase/client'
import { useCourses } from '../hooks/useCourses'
import Navbar from '../components/Navbar'
import type { Course, RecurringRule, AssignmentType, AssignmentPlatform } from '../types'
import { courseLabel, moodleCourseUrl } from '../lib/courseLabel'

type UploadState = 'idle' | 'uploading' | 'parsing' | 'done' | 'error'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function generateDates(startDate: string, endDate: string, dayOfWeek: number): string[] {
  const dates: string[] = []
  const cur = new Date(startDate + 'T12:00:00')
  const end = new Date(endDate + 'T12:00:00')
  while (cur.getDay() !== dayOfWeek) cur.setDate(cur.getDate() + 1)
  while (cur <= end) {
    dates.push(cur.toISOString().split('T')[0])
    cur.setDate(cur.getDate() + 7)
  }
  return dates
}

const inputStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: '10px',
  background: 'var(--bg-surface)',
  color: 'var(--text-secondary)',
  border: '1px solid var(--border-default)',
  padding: '6px 10px',
  outline: 'none',
  width: '100%',
}

export default function CoursesPage() {
  const [authed, setAuthed] = useState(false)
  const [uploadStates, setUploadStates] = useState<Record<string, UploadState>>({})
  const [rules, setRules] = useState<RecurringRule[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formCourseId, setFormCourseId] = useState('')
  const [formTitle, setFormTitle] = useState('Quiz')
  const [formDay, setFormDay] = useState('5')  // Friday default
  const [formType, setFormType] = useState<AssignmentType>('quiz')
  const [formPlatform, setFormPlatform] = useState<AssignmentPlatform>('in-class')
  const [formStart, setFormStart] = useState('2026-02-27')
  const [formEnd, setFormEnd] = useState('2026-05-09')
  const navigate = useNavigate()
  const { courses, loading } = useCourses()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) navigate('/login')
      else {
        setAuthed(true)
        supabase.from('recurring_rules').select('*, course:courses(*)').order('created_at').then(({ data }) => {
          if (data) setRules(data as RecurringRule[])
        })
      }
    })
  }, [navigate])

  async function handleUpload(course: Course, file: File) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    setUploadStates(s => ({ ...s, [course.id]: 'uploading' }))
    try {
      const storagePath = `syllabi/${user.id}/${course.id}/syllabus.pdf`
      const { error: uploadError } = await supabase.storage
        .from('syllabi').upload(storagePath, file, { upsert: true })
      if (uploadError) throw uploadError

      const { data: syllabusRecord, error: insertError } = await supabase
        .from('syllabi')
        .insert({ user_id: user.id, course_id: course.id, file_path: storagePath })
        .select().single()
      if (insertError) throw insertError

      setUploadStates(s => ({ ...s, [course.id]: 'parsing' }))
      await supabase.functions.invoke('parse-syllabi', {
        body: { syllabus_id: syllabusRecord.id, user_id: user.id, file_path: storagePath, course_name: course.name },
      })

      setUploadStates(s => ({ ...s, [course.id]: 'done' }))
    } catch {
      setUploadStates(s => ({ ...s, [course.id]: 'error' }))
    }
  }

  async function handleAddRule(e: React.FormEvent) {
    e.preventDefault()
    if (!formCourseId || !formTitle.trim()) return
    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    const dayOfWeek = parseInt(formDay, 10)
    const { data: rule, error } = await supabase
      .from('recurring_rules')
      .insert({
        user_id: user.id,
        course_id: formCourseId,
        title: formTitle.trim(),
        day_of_week: dayOfWeek,
        type: formType,
        platform: formPlatform,
        start_date: formStart,
        end_date: formEnd,
      })
      .select('*, course:courses(*)')
      .single()

    if (error || !rule) { setSaving(false); return }

    // Generate one assignment per matching weekday
    const dates = generateDates(formStart, formEnd, dayOfWeek)
    if (dates.length > 0) {
      const rows = dates.map(d => ({
        user_id: user.id,
        course_id: formCourseId,
        title: formTitle.trim(),
        due_date: d,
        type: formType,
        platform: formPlatform,
        source: 'recurring',
        parse_confidence: 'high',
        recurring_rule_id: rule.id,
      }))
      await supabase.from('assignments').insert(rows)
    }

    setRules(rs => [...rs, rule as RecurringRule])
    setShowAddForm(false)
    setFormTitle('Quiz')
    setFormDay('5')
    setFormType('quiz')
    setFormPlatform('in-class')
    setSaving(false)
  }

  async function handleDeleteRule(ruleId: string) {
    // Cascade deletes all generated assignments via FK
    await supabase.from('recurring_rules').delete().eq('id', ruleId)
    setRules(rs => rs.filter(r => r.id !== ruleId))
  }

  if (!authed) return null

  // Group rules by course_id for display
  const rulesByCourse = rules.reduce<Record<string, RecurringRule[]>>((acc, r) => {
    if (!acc[r.course_id]) acc[r.course_id] = []
    acc[r.course_id].push(r)
    return acc
  }, {})

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <div className="hud-grid-bg" />
      <Navbar />

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '32px 24px', position: 'relative', zIndex: 1 }}>
        {/* ── COURSES ── */}
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--accent-cyan)', letterSpacing: '0.16em', marginBottom: '8px' }}>
          // COURSE MANIFEST
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.1em', marginBottom: '24px' }}>
          ENROLLED COURSES
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="hud-panel animate-in" style={{ height: '64px', animationDelay: `${i * 0.06}s`, opacity: 0 }}>
                <span className="hud-corner-tr" /><span className="hud-corner-bl" />
              </div>
            ))}
          </div>
        ) : courses.length === 0 ? (
          <div className="hud-panel" style={{ padding: '32px', textAlign: 'center' }}>
            <span className="hud-corner-tr" /><span className="hud-corner-bl" />
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-dim)' }}>
              NO COURSES DETECTED — SYNC YOUR MOODLE ACCOUNT
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {courses.map((course, i) => (
              <div
                key={course.id}
                className="hud-panel animate-in"
                style={{ display: 'flex', alignItems: 'center', overflow: 'hidden', animationDelay: `${i * 0.05}s`, opacity: 0 }}
              >
                <span className="hud-corner-tr" /><span className="hud-corner-bl" />
                <div style={{ width: '3px', alignSelf: 'stretch', background: course.color, flexShrink: 0, boxShadow: `0 0 8px ${course.color}55` }} />
                <a
                  href={moodleCourseUrl(course.moodle_course_id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ flex: 1, padding: '14px 16px', textDecoration: 'none', display: 'block' }}
                >
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 600, color: 'var(--accent-cyan)', letterSpacing: '0.12em', marginBottom: '3px' }}>
                    {courseLabel(course.name, course.short_name)}
                  </div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '11px', color: 'var(--text-secondary)', letterSpacing: '0.04em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {course.name}
                  </div>
                </a>
                <div style={{ padding: '0 16px', flexShrink: 0 }}>
                  {(() => {
                    const state = uploadStates[course.id] || (course.syllabus_parsed ? 'done' : 'idle')
                    if (state === 'done') return (
                      <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.1em', color: 'var(--accent-green)', border: '1px solid rgba(0,255,157,0.3)', padding: '2px 6px' }}>✓ PARSED</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.08em', color: 'var(--text-dim)', border: '1px solid var(--border-default)', padding: '2px 6px' }}>REPLACE</span>
                        <input type="file" accept=".pdf" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(course, f) }} />
                      </label>
                    )
                    if (state === 'uploading') return <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--accent-cyan)', letterSpacing: '0.1em' }}>UPLOADING...</span>
                    if (state === 'parsing') return <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--accent-cyan)', letterSpacing: '0.1em' }}>PARSING...</span>
                    if (state === 'error') return (
                      <label style={{ cursor: 'pointer' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--accent-red)', letterSpacing: '0.1em', border: '1px solid rgba(255,59,59,0.3)', padding: '2px 6px' }}>ERROR — RETRY</span>
                        <input type="file" accept=".pdf" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(course, f) }} />
                      </label>
                    )
                    return (
                      <label style={{ cursor: 'pointer' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.1em', color: 'var(--accent-cyan)', border: '1px solid rgba(0,212,255,0.3)', padding: '2px 8px' }}>+ UPLOAD PDF</span>
                        <input type="file" accept=".pdf" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(course, f) }} />
                      </label>
                    )
                  })()}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── RECURRING PATTERNS ── */}
        {!loading && courses.length > 0 && (
          <div style={{ marginTop: '40px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--accent-cyan)', letterSpacing: '0.16em', marginBottom: '8px' }}>
              // RECURRING PATTERNS
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.1em' }}>
                WEEKLY SCHEDULES
              </div>
              {!showAddForm && (
                <button className="hud-btn" onClick={() => setShowAddForm(true)} style={{ fontSize: '9px', padding: '4px 12px' }}>
                  + ADD PATTERN
                </button>
              )}
            </div>

            {/* Add rule form */}
            {showAddForm && (
              <div className="hud-panel animate-in" style={{ padding: '20px', marginBottom: '16px' }}>
                <span className="hud-corner-tr" /><span className="hud-corner-bl" />
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--accent-cyan)', letterSpacing: '0.16em', marginBottom: '16px' }}>
                  // NEW RECURRING PATTERN
                </div>
                <form onSubmit={handleAddRule} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--accent-cyan)', letterSpacing: '0.12em', display: 'block', marginBottom: '5px' }}>COURSE</label>
                      <select value={formCourseId} onChange={e => setFormCourseId(e.target.value)} style={inputStyle} required>
                        <option value="">SELECT COURSE...</option>
                        {courses.map(c => <option key={c.id} value={c.id}>{courseLabel(c.name, c.short_name)}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--accent-cyan)', letterSpacing: '0.12em', display: 'block', marginBottom: '5px' }}>TITLE</label>
                      <input style={inputStyle} value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="Quiz" required />
                    </div>
                    <div>
                      <label style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--accent-cyan)', letterSpacing: '0.12em', display: 'block', marginBottom: '5px' }}>DAY OF WEEK</label>
                      <select value={formDay} onChange={e => setFormDay(e.target.value)} style={inputStyle}>
                        {DAYS.map((d, i) => <option key={i} value={i}>{d.toUpperCase()}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--accent-cyan)', letterSpacing: '0.12em', display: 'block', marginBottom: '5px' }}>TYPE</label>
                      <select value={formType} onChange={e => setFormType(e.target.value as AssignmentType)} style={inputStyle}>
                        {(['quiz','homework','reading','exam','project','other'] as AssignmentType[]).map(t => (
                          <option key={t} value={t}>{t.toUpperCase()}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--accent-cyan)', letterSpacing: '0.12em', display: 'block', marginBottom: '5px' }}>START DATE</label>
                      <input style={inputStyle} type="date" value={formStart} onChange={e => setFormStart(e.target.value)} required />
                    </div>
                    <div>
                      <label style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--accent-cyan)', letterSpacing: '0.12em', display: 'block', marginBottom: '5px' }}>END DATE</label>
                      <input style={inputStyle} type="date" value={formEnd} onChange={e => setFormEnd(e.target.value)} required />
                    </div>
                  </div>
                  {formStart && formEnd && formDay && (
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-dim)', letterSpacing: '0.06em' }}>
                      {generateDates(formStart, formEnd, parseInt(formDay, 10)).length} occurrences will be added
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button type="submit" disabled={saving} className="hud-btn hud-btn-primary" style={{ flex: 1, fontSize: '10px' }}>
                      {saving ? 'GENERATING...' : 'GENERATE ASSIGNMENTS'}
                    </button>
                    <button type="button" className="hud-btn" onClick={() => setShowAddForm(false)} style={{ fontSize: '10px', padding: '6px 16px' }}>
                      CANCEL
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Existing rules */}
            {Object.keys(rulesByCourse).length === 0 && !showAddForm ? (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-dim)', padding: '16px 0', letterSpacing: '0.06em' }}>
                No recurring patterns defined. Add one to automatically populate weekly quizzes, readings, or problem sets.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {courses.filter(c => rulesByCourse[c.id]).map(course => (
                  <div key={course.id}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-dim)', letterSpacing: '0.1em', marginBottom: '4px', paddingLeft: '4px' }}>
                      {courseLabel(course.name, course.short_name)}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {rulesByCourse[course.id].map(rule => (
                        <div key={rule.id} className="hud-panel" style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', gap: '10px' }}>
                          <div style={{ width: '3px', alignSelf: 'stretch', background: course.color, flexShrink: 0 }} />
                          <div style={{ flex: 1, paddingLeft: '8px' }}>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-primary)', letterSpacing: '0.04em' }}>
                              {rule.title}
                            </span>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-dim)', marginLeft: '10px', letterSpacing: '0.08em' }}>
                              EVERY {DAYS[rule.day_of_week].toUpperCase()} · {rule.type.toUpperCase()} · {rule.start_date} → {rule.end_date}
                            </span>
                          </div>
                          <button
                            onClick={() => handleDeleteRule(rule.id)}
                            style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--accent-red)', background: 'none', border: '1px solid rgba(255,59,59,0.3)', padding: '2px 8px', cursor: 'pointer', letterSpacing: '0.08em', flexShrink: 0 }}
                          >
                            DELETE
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
