import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase/client'

export default function LoginPage() {
  const [isSignup, setIsSignup] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!email.endsWith('@colgate.edu')) {
      setError('ACCESS RESTRICTED TO @colgate.edu ADDRESSES')
      return
    }

    setLoading(true)
    try {
      if (isSignup) {
        const { data, error: err } = await supabase.auth.signUp({ email, password })
        if (err) throw err
        if (data.session) {
          navigate('/onboarding')
        } else {
          throw new Error('EMAIL CONFIRMATION MUST BE DISABLED IN SUPABASE DASHBOARD')
        }
      } else {
        const { data, error: err } = await supabase.auth.signInWithPassword({ email, password })
        if (err) throw err
        const { data: userData } = await supabase
          .from('users')
          .select('onboarding_complete')
          .eq('id', data.user.id)
          .single()
        navigate(userData?.onboarding_complete ? '/dashboard' : '/onboarding')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message.toUpperCase() : 'AUTHENTICATION FAILURE')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-primary)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div className="hud-grid-bg" />

      {/* Ambient reactor glow */}
      <div style={{
        position: 'absolute',
        top: '35%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '700px',
        height: '700px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(0,212,255,0.05) 0%, transparent 65%)',
        animation: 'reactor-breathe 4s ease-in-out infinite',
        pointerEvents: 'none',
      }} />

      {/* Login panel */}
      <div
        className="hud-panel animate-in"
        style={{ width: '100%', maxWidth: '420px', padding: '40px 36px', position: 'relative', zIndex: 1 }}
      >
        <span className="hud-corner-tr" />
        <span className="hud-corner-bl" />

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: '28px',
            fontWeight: 900,
            color: 'var(--accent-cyan)',
            letterSpacing: '0.2em',
            textShadow: '0 0 20px rgba(0,212,255,0.4), 0 0 40px rgba(0,212,255,0.15)',
            marginBottom: '8px',
          }}>
            COLGATE+
          </div>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            color: 'var(--text-dim)',
            letterSpacing: '0.2em',
          }}>
            ACADEMIC COMMAND INTERFACE
          </div>
          <div style={{
            marginTop: '20px',
            height: '1px',
            background: 'linear-gradient(90deg, transparent, var(--border-active), transparent)',
          }} />
        </div>

        {/* Mode toggle */}
        <div style={{
          display: 'flex',
          marginBottom: '28px',
          border: '1px solid var(--border-default)',
        }}>
          {(['SIGN IN', 'CREATE ACCOUNT'] as const).map((label, i) => {
            const active = (i === 0) === !isSignup
            return (
              <button
                key={label}
                onClick={() => { setIsSignup(i === 1); setError(null) }}
                style={{
                  flex: 1,
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                  letterSpacing: '0.1em',
                  padding: '9px',
                  background: active ? 'rgba(0,212,255,0.1)' : 'transparent',
                  color: active ? 'var(--accent-cyan)' : 'var(--text-dim)',
                  border: 'none',
                  borderRight: i === 0 ? '1px solid var(--border-default)' : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                {label}
              </button>
            )
          })}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div>
            <label style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '9px',
              color: 'var(--accent-cyan)',
              letterSpacing: '0.16em',
              display: 'block',
              marginBottom: '8px',
            }}>
              COLGATE EMAIL
            </label>
            <input
              className="hud-input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="username@colgate.edu"
              required
              autoComplete="email"
            />
          </div>

          <div>
            <label style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '9px',
              color: 'var(--accent-cyan)',
              letterSpacing: '0.16em',
              display: 'block',
              marginBottom: '8px',
            }}>
              PASSPHRASE
            </label>
            <input
              className="hud-input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete={isSignup ? 'new-password' : 'current-password'}
            />
          </div>

          {error && (
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              color: 'var(--accent-red)',
              letterSpacing: '0.08em',
              padding: '10px 12px',
              border: '1px solid rgba(255,59,59,0.3)',
              background: 'rgba(255,59,59,0.05)',
            }}>
              ▲ ERROR: {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="hud-btn hud-btn-primary"
            style={{ width: '100%', marginTop: '4px' }}
          >
            {loading ? 'AUTHENTICATING...' : isSignup ? 'INITIALIZE ACCOUNT' : 'INITIALIZE SESSION'}
          </button>
        </form>
      </div>
    </div>
  )
}
