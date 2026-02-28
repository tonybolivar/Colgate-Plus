import { Link, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase/client'
import SyncStatus from './dashboard/SyncStatus'

export default function Navbar() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <nav style={{
      background: 'rgba(5, 8, 16, 0.96)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--border-default)',
      height: '56px',
      display: 'flex',
      alignItems: 'center',
      padding: '0 24px',
      justifyContent: 'space-between',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      overflow: 'hidden',
    }}>
      {/* Scanning highlight */}
      <div style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        width: '15%',
        background: 'linear-gradient(90deg, transparent, rgba(0,212,255,0.07), transparent)',
        animation: 'nav-scan 4s linear infinite',
        pointerEvents: 'none',
      }} />

      {/* Logo */}
      <Link to="/dashboard" style={{
        fontFamily: 'var(--font-display)',
        fontSize: '15px',
        fontWeight: 900,
        color: 'var(--accent-cyan)',
        textDecoration: 'none',
        letterSpacing: '0.18em',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        textShadow: '0 0 12px rgba(0,212,255,0.4)',
        flexShrink: 0,
      }}>
        <span style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: 'var(--accent-cyan)',
          boxShadow: '0 0 8px var(--accent-cyan)',
          animation: 'pulse-dot 2s ease infinite',
          flexShrink: 0,
          display: 'inline-block',
        }} />
        COLGATE+
      </Link>

      {/* Nav links */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '28px' }}>
        {([
          { to: '/dashboard', label: 'DASHBOARD' },
          { to: '/courses', label: 'COURSES' },
          { to: '/assignments', label: 'ASSIGNMENTS' },
          { to: '/settings', label: 'SETTINGS' },
        ] as const).map(({ to, label }) => (
          <Link
            key={to}
            to={to}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              letterSpacing: '0.12em',
              color: pathname === to ? 'var(--accent-cyan)' : 'var(--text-secondary)',
              textDecoration: 'none',
              transition: 'color 0.2s, text-shadow 0.2s',
              textShadow: pathname === to ? '0 0 8px rgba(0,212,255,0.5)' : 'none',
            }}
          >
            {label}
          </Link>
        ))}

        <div style={{ height: '16px', width: '1px', background: 'var(--border-default)' }} />
        <SyncStatus />
        <button
          onClick={handleSignOut}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            letterSpacing: '0.1em',
            color: 'var(--text-dim)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            transition: 'color 0.2s',
            padding: 0,
          }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-dim)')}
        >
          SIGN OUT
        </button>
      </div>
    </nav>
  )
}
