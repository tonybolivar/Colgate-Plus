import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase/client'
import { useMoodleSync } from '../../hooks/useMoodleSync'
import type { Course } from '../../types'

type Step = 'init' | 'disclosure' | 'connect' | 'syncing' | 'complete'

function extractToken(input: string): string | null {
  const s = input.trim()
  if (s.startsWith('moodlemobile://token=')) {
    const b64 = s.slice('moodlemobile://token='.length)
    try {
      const decoded = atob(b64)
      try { return JSON.parse(decoded).token ?? null }
      catch { return decoded.split(':::')[0] || null }
    } catch { return null }
  }
  if (s.length >= 32) return s
  return null
}

function StepLabel({ n, label, active }: { n: number; label: string; active: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: active ? 1 : 0.35 }}>
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: '9px',
        color: active ? 'var(--accent-cyan)' : 'var(--text-dim)',
        border: `1px solid ${active ? 'var(--accent-cyan)' : 'var(--border-default)'}`,
        padding: '1px 5px', transition: 'all 0.3s',
      }}>{String(n).padStart(2, '0')}</span>
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: '9px',
        color: active ? 'var(--text-secondary)' : 'var(--text-dim)', letterSpacing: '0.1em',
      }}>{label}</span>
    </div>
  )
}

export default function OnboardingFlow() {
  const [step, setStep] = useState<Step>('init')
  const [pasted, setPasted] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [courses, setCourses] = useState<Course[]>([])
  const [uploadStates, setUploadStates] = useState<Record<string, 'idle' | 'uploading' | 'parsing' | 'done' | 'error'>>({})
  const { progress, triggerSync } = useMoodleSync()
  const navigate = useNavigate()

  const steps: { key: Step; label: string }[] = [
    { key: 'init',       label: 'SYSTEM INIT' },
    { key: 'disclosure', label: 'SECURITY DISCLOSURE' },
    { key: 'connect',    label: 'AUTH TOKEN' },
    { key: 'syncing',    label: 'ESTABLISHING LINK' },
    { key: 'complete',   label: 'ONLINE' },
  ]

  // After sync completes, load courses to show upload prompts
  useEffect(() => {
    if (step !== 'complete') return
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('courses').select('*').eq('user_id', user.id).order('name').then(({ data }) => {
        if (data) setCourses(data)
      })
    })
  }, [step])

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const token = extractToken(pasted)
    if (!token) { setError('INVALID TOKEN FORMAT — PASTE THE RAW TOKEN STRING'); return }

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setError('SESSION EXPIRED — REINITIALIZE FROM LOGIN'); return }

    setConnecting(true)
    try {
      const { data, error: fnError } = await supabase.functions.invoke('connect-moodle', { body: { token } })
      if (fnError || !data?.success) throw new Error(data?.error || fnError?.message || 'CONNECTION FAILED')
      setStep('syncing')
      await triggerSync()
      setStep('complete')
    } catch (err) {
      setError(err instanceof Error ? err.message.toUpperCase() : 'CONNECTION FAILURE')
    } finally {
      setConnecting(false)
    }
  }

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
      setCourses(cs => cs.map(c => c.id === course.id ? { ...c, syllabus_parsed: true } : c))
    } catch {
      setUploadStates(s => ({ ...s, [course.id]: 'error' }))
    }
  }

  async function handleFinish() {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) await supabase.from('users').update({ onboarding_complete: true }).eq('id', user.id)
    navigate('/dashboard')
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg-primary)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px', position: 'relative', overflow: 'hidden',
    }}>
      <div className="hud-grid-bg" />
      <div style={{
        position: 'absolute', top: '35%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '600px', height: '600px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(0,212,255,0.04) 0%, transparent 65%)',
        animation: 'reactor-breathe 4s ease-in-out infinite', pointerEvents: 'none',
      }} />

      <div style={{ width: '100%', maxWidth: '520px', position: 'relative', zIndex: 1 }}>
        {/* Step indicators */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
          {steps.map(s => (
            <StepLabel key={s.key} n={steps.findIndex(x => x.key === s.key) + 1} label={s.label} active={s.key === step} />
          ))}
        </div>

        <div className="hud-panel animate-in" style={{ padding: '36px' }}>
          <span className="hud-corner-tr" /><span className="hud-corner-bl" />

          {/* ── STEP 1: INIT ── */}
          {step === 'init' && (
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--accent-cyan)', letterSpacing: '0.16em', marginBottom: '16px' }}>// SYSTEM INITIALIZATION</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.08em', marginBottom: '12px' }}>WELCOME, OPERATOR</div>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.8', marginBottom: '24px' }}>
                Colgate+ will connect to your Moodle account, retrieve your enrolled courses, then use AI to parse each syllabus you upload — surfacing every deadline automatically.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '28px' }}>
                {['Retrieve all enrolled courses from Moodle', 'Upload your syllabus PDFs for each course', 'AI extracts every deadline into a unified command view'].map((item, i) => (
                  <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--accent-cyan)', border: '1px solid rgba(0,212,255,0.3)', padding: '1px 4px', flexShrink: 0, marginTop: '1px' }}>{String(i + 1).padStart(2, '0')}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-secondary)', letterSpacing: '0.04em' }}>{item}</span>
                  </div>
                ))}
              </div>
              <button className="hud-btn hud-btn-primary" style={{ width: '100%' }} onClick={() => setStep('disclosure')}>PROCEED TO SECURITY DISCLOSURE</button>
            </div>
          )}

          {/* ── STEP 2: DISCLOSURE ── */}
          {step === 'disclosure' && (
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--accent-amber)', letterSpacing: '0.16em', marginBottom: '16px' }}>// SECURITY DISCLOSURE</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.08em', marginBottom: '16px' }}>DATA ACCESS PROTOCOL</div>
              <div style={{ border: '1px solid rgba(255,179,71,0.25)', background: 'rgba(255,179,71,0.04)', padding: '16px', marginBottom: '20px' }}>
                {['Your Moodle API token is encrypted with AES-256 before storage.', 'Your Colgate password is never requested, transmitted, or stored.', 'Course data and syllabi are accessed read-only.', 'All Moodle API calls occur server-side. Nothing touches your browser.'].map((item, i) => (
                  <div key={i} style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.7', display: 'flex', gap: '8px', marginBottom: i < 3 ? '8px' : 0 }}>
                    <span style={{ color: 'var(--accent-amber)', flexShrink: 0 }}>▸</span>{item}
                  </div>
                ))}
              </div>
              <button className="hud-btn hud-btn-primary" style={{ width: '100%' }} onClick={() => setStep('connect')}>ACKNOWLEDGED — PROCEED</button>
            </div>
          )}

          {/* ── STEP 3: CONNECT ── */}
          {step === 'connect' && (
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--accent-cyan)', letterSpacing: '0.16em', marginBottom: '16px' }}>// AUTHENTICATION REQUIRED</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.08em', marginBottom: '20px' }}>MOODLE TOKEN ACQUISITION</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px' }}>
                {[
                  { n: '01', title: 'OPEN TOKEN MANAGEMENT', body: 'Navigate to your Moodle security keys page.', action: (
                    <a href="https://moodle.colgate.edu/user/managetoken.php" target="_blank" rel="noopener noreferrer"
                      style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--accent-cyan)', letterSpacing: '0.08em', textDecoration: 'none', border: '1px solid var(--border-default)', padding: '5px 10px', display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '8px', transition: 'border-color 0.2s' }}>
                      → OPEN MOODLE TOKEN PAGE
                    </a>
                  )},
                  { n: '02', title: 'RESET MOBILE SERVICE TOKEN', body: 'Find "Moodle mobile web service" and click Reset. Copy the token that appears.' },
                  { n: '03', title: 'TRANSMIT TOKEN', body: 'Paste the token string below.' },
                ].map(item => (
                  <div key={item.n} style={{ display: 'flex', gap: '12px' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--accent-cyan)', border: '1px solid rgba(0,212,255,0.3)', padding: '2px 6px', height: 'fit-content', flexShrink: 0, marginTop: '1px' }}>{item.n}</span>
                    <div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-primary)', letterSpacing: '0.08em', marginBottom: '3px' }}>{item.title}</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-dim)', lineHeight: '1.6' }}>{item.body}</div>
                      {item.action}
                    </div>
                  </div>
                ))}
              </div>
              <form onSubmit={handleConnect} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--accent-cyan)', letterSpacing: '0.16em', display: 'block', marginBottom: '8px' }}>MOODLE TOKEN</label>
                  <input className="hud-input" type="text" value={pasted} onChange={e => setPasted(e.target.value)} placeholder="Paste token string here..." />
                </div>
                {error && (
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--accent-red)', letterSpacing: '0.08em', padding: '8px 12px', border: '1px solid rgba(255,59,59,0.3)', background: 'rgba(255,59,59,0.04)' }}>▲ {error}</div>
                )}
                <button type="submit" disabled={connecting || !pasted.trim()} className="hud-btn hud-btn-primary" style={{ width: '100%' }}>
                  {connecting ? 'ESTABLISHING CONNECTION...' : 'TRANSMIT TOKEN'}
                </button>
              </form>
            </div>
          )}

          {/* ── STEP 4: SYNCING ── */}
          {step === 'syncing' && (
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--accent-cyan)', letterSpacing: '0.16em', marginBottom: '28px' }}>// ESTABLISHING MOODLE LINK</div>
              <div style={{ height: '2px', background: 'var(--border-default)', borderRadius: '1px', overflow: 'hidden', marginBottom: '24px', position: 'relative' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: '30%', background: 'linear-gradient(90deg, transparent, var(--accent-cyan), transparent)', animation: 'progress-scan 1.5s linear infinite' }} />
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.1em', marginBottom: '8px' }}>
                SYNCING COURSES
              </div>
              {progress.current_course && (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-dim)', letterSpacing: '0.06em' }}>{progress.current_course}</div>
              )}
              {progress.status === 'error' && (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--accent-red)', marginTop: '16px', padding: '8px 12px', border: '1px solid rgba(255,59,59,0.3)' }}>▲ {progress.error}</div>
              )}
            </div>
          )}

          {/* ── STEP 5: COMPLETE ── */}
          {step === 'complete' && (
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--accent-cyan)', letterSpacing: '0.16em', marginBottom: '16px' }}>// UPLOAD SYLLABI</div>

              <div style={{ fontFamily: 'var(--font-display)', fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.08em', marginBottom: '6px' }}>
                {progress.completed} COURSE{progress.completed !== 1 ? 'S' : ''} LOADED
              </div>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-dim)', lineHeight: '1.7', marginBottom: '20px' }}>
                Upload a PDF syllabus for each course. Colgate+ will parse every deadline automatically.
              </p>

              {courses.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '20px' }}>
                  {courses.map(course => (
                    <CourseUploadRow key={course.id} course={course} state={uploadStates[course.id] || (course.syllabus_parsed ? 'done' : 'idle')} onUpload={handleUpload} />
                  ))}
                </div>
              ) : (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-dim)', marginBottom: '20px' }}>
                  No courses detected. You can add syllabi from the Courses page after setup.
                </div>
              )}

              <button className="hud-btn hud-btn-primary" style={{ width: '100%' }} onClick={handleFinish}>
                ENTER COMMAND INTERFACE
              </button>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-dim)', textAlign: 'center', marginTop: '8px', letterSpacing: '0.08em' }}>
                You can also upload or re-upload syllabi anytime from the Courses page.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function CourseUploadRow({ course, state, onUpload }: {
  course: Course
  state: 'idle' | 'uploading' | 'parsing' | 'done' | 'error'
  onUpload: (course: Course, file: File) => void
}) {
  const shortName = (course.short_name || course.name).toUpperCase().slice(0, 24)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', border: '1px solid var(--border-default)', background: 'var(--bg-surface-2)' }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-secondary)', flex: 1, letterSpacing: '0.04em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {shortName}
      </span>

      {state === 'done' ? (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--accent-green)', letterSpacing: '0.1em' }}>✓ PARSED</span>
      ) : state === 'uploading' ? (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--accent-cyan)', letterSpacing: '0.1em' }}>UPLOADING...</span>
      ) : state === 'parsing' ? (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--accent-cyan)', letterSpacing: '0.1em' }}>PARSING...</span>
      ) : state === 'error' ? (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--accent-red)', letterSpacing: '0.1em' }}>ERROR</span>
      ) : (
        <label style={{
          fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.1em',
          color: 'var(--accent-cyan)', border: '1px solid rgba(0,212,255,0.3)',
          padding: '3px 8px', cursor: 'pointer', transition: 'all 0.2s',
          whiteSpace: 'nowrap',
        }}>
          + UPLOAD PDF
          <input
            type="file" accept=".pdf" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(course, f) }}
          />
        </label>
      )}
    </div>
  )
}
