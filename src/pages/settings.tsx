import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase/client'
import Navbar from '../components/Navbar'
import type { User } from '../types'

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null)
  const [fullName, setFullName] = useState('')
  const [gradYear, setGradYear] = useState('')
  const [major, setMajor] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [disconnecting, setDisconnecting] = useState(false)
  const [gsPassword, setGsPassword] = useState('')
  const [gsConnecting, setGsConnecting] = useState(false)
  const [gsError, setGsError] = useState<string | null>(null)
  const [gsSaved, setGsSaved] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    async function load() {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) { navigate('/login'); return }
      const { data } = await supabase.from('users').select('*').eq('id', authUser.id).single()
      if (data) {
        setUser(data)
        setFullName(data.full_name || '')
        setGradYear(data.grad_year ? String(data.grad_year) : '')
        setMajor(data.major || '')
      }
    }
    load()
  }, [navigate])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const { error } = await supabase
      .from('users')
      .update({ full_name: fullName || null, grad_year: gradYear ? parseInt(gradYear) : null, major: major || null })
      .eq('id', user!.id)
    setSaving(false)
    if (error) setError(error.message.toUpperCase())
    else { setSaved(true); setTimeout(() => setSaved(false), 2000) }
  }

  async function handleConnectGradescope(e: React.FormEvent) {
    e.preventDefault()
    setGsConnecting(true)
    setGsError(null)
    const { data, error } = await supabase.functions.invoke('connect-gradescope', { body: { password: gsPassword } })
    setGsConnecting(false)
    if (error || data?.error) {
      setGsError((data?.error || error?.message || 'Connection failed').toUpperCase())
    } else {
      setGsSaved(true)
      setGsPassword('')
      setUser(u => u ? { ...u, gradescope_connected: true } : u)
      setTimeout(() => setGsSaved(false), 3000)
    }
  }

  async function handleDisconnectMoodle() {
    if (!window.confirm('Disconnect Moodle? You will need to reconnect to sync courses.')) return
    setDisconnecting(true)
    await supabase
      .from('users')
      .update({ moodle_token_encrypted: null, moodle_token_iv: null, onboarding_complete: false })
      .eq('id', user!.id)
    navigate('/onboarding')
  }

  if (!user) return null

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'transparent',
    border: 'none',
    borderBottom: '1px solid var(--border-default)',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-mono)',
    fontSize: '13px',
    padding: '10px 0',
    outline: 'none',
    transition: 'border-color 0.2s ease',
    caretColor: 'var(--accent-cyan)',
  }

  const labelStyle: React.CSSProperties = {
    fontFamily: 'var(--font-mono)',
    fontSize: '9px',
    color: 'var(--accent-cyan)',
    letterSpacing: '0.16em',
    display: 'block',
    marginBottom: '8px',
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <div className="hud-grid-bg" />
      <Navbar />

      <div style={{ maxWidth: '560px', margin: '0 auto', padding: '32px 24px', position: 'relative', zIndex: 1 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--accent-cyan)', letterSpacing: '0.16em', marginBottom: '8px' }}>
          // OPERATOR PROFILE
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.1em', marginBottom: '24px' }}>
          SETTINGS
        </div>

        {/* Profile panel */}
        <div className="hud-panel animate-in" style={{ padding: '24px', marginBottom: '16px' }}>
          <span className="hud-corner-tr" /><span className="hud-corner-bl" />
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-dim)', letterSpacing: '0.14em', marginBottom: '20px' }}>
            // PROFILE DATA
          </div>
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label style={labelStyle}>FULL NAME</label>
              <input style={inputStyle} type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your name" onFocus={e => (e.target.style.borderBottomColor = 'var(--accent-cyan)')} onBlur={e => (e.target.style.borderBottomColor = 'var(--border-default)')} />
            </div>
            <div>
              <label style={labelStyle}>GRADUATION YEAR</label>
              <input style={inputStyle} type="number" value={gradYear} onChange={e => setGradYear(e.target.value)} placeholder="e.g. 2026" min="2020" max="2030" onFocus={e => (e.target.style.borderBottomColor = 'var(--accent-cyan)')} onBlur={e => (e.target.style.borderBottomColor = 'var(--border-default)')} />
            </div>
            <div>
              <label style={labelStyle}>MAJOR</label>
              <input style={inputStyle} type="text" value={major} onChange={e => setMajor(e.target.value)} placeholder="e.g. Computer Science" onFocus={e => (e.target.style.borderBottomColor = 'var(--accent-cyan)')} onBlur={e => (e.target.style.borderBottomColor = 'var(--border-default)')} />
            </div>
            {error && (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--accent-red)', padding: '8px 12px', border: '1px solid rgba(255,59,59,0.3)', background: 'rgba(255,59,59,0.04)' }}>
                ▲ {error}
              </div>
            )}
            <button type="submit" disabled={saving} className="hud-btn hud-btn-primary" style={{ width: '100%' }}>
              {saving ? 'SAVING...' : saved ? '// SAVED' : 'SAVE PROFILE'}
            </button>
          </form>
        </div>

        {/* Gradescope panel */}
        <div className="hud-panel animate-in delay-1" style={{ padding: '24px', marginBottom: '16px' }}>
          <span className="hud-corner-tr" /><span className="hud-corner-bl" />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-dim)', letterSpacing: '0.14em' }}>
              // GRADESCOPE
            </div>
            {user.gradescope_connected && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--accent-green)', letterSpacing: '0.1em', border: '1px solid rgba(0,255,157,0.3)', padding: '1px 6px' }}>
                ✓ CONNECTED
              </span>
            )}
          </div>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-dim)', lineHeight: '1.7', marginBottom: '16px' }}>
            {user.gradescope_connected
              ? 'Gradescope is connected. Re-enter your password below to update credentials.'
              : 'Enter your Gradescope password to sync assignment due dates and submission statuses.'}
          </p>
          <form onSubmit={handleConnectGradescope} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={labelStyle}>GRADESCOPE PASSWORD</label>
              <input
                style={inputStyle}
                type="password"
                value={gsPassword}
                onChange={e => setGsPassword(e.target.value)}
                placeholder="Your Gradescope password"
                onFocus={e => (e.target.style.borderBottomColor = 'var(--accent-cyan)')}
                onBlur={e => (e.target.style.borderBottomColor = 'var(--border-default)')}
              />
            </div>
            {gsError && (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--accent-red)', padding: '8px 12px', border: '1px solid rgba(255,59,59,0.3)', background: 'rgba(255,59,59,0.04)' }}>
                ▲ {gsError}
              </div>
            )}
            <button type="submit" disabled={gsConnecting || !gsPassword.trim()} className="hud-btn hud-btn-primary" style={{ width: '100%' }}>
              {gsConnecting ? 'CONNECTING...' : gsSaved ? '// CONNECTED' : user.gradescope_connected ? 'UPDATE PASSWORD' : 'CONNECT GRADESCOPE'}
            </button>
          </form>
        </div>

        {/* Account panel */}
        <div className="hud-panel animate-in delay-1" style={{ padding: '24px' }}>
          <span className="hud-corner-tr" /><span className="hud-corner-bl" />
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-dim)', letterSpacing: '0.14em', marginBottom: '6px' }}>
            // ACCOUNT
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-dim)', letterSpacing: '0.06em', marginBottom: '20px' }}>
            {user.email}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
              onClick={handleDisconnectMoodle}
              disabled={disconnecting}
              className="hud-btn"
              style={{ width: '100%', color: 'var(--accent-amber)', borderColor: 'rgba(255,179,71,0.3)' }}
            >
              {disconnecting ? 'DISCONNECTING...' : 'RECONNECT MOODLE'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
