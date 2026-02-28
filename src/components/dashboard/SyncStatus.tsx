import { useState, useEffect } from 'react'
import { useMoodleSync } from '../../hooks/useMoodleSync'
import { formatDistanceToNow } from 'date-fns'
import { useCourses } from '../../hooks/useCourses'
import { supabase } from '../../lib/supabase/client'

const SYNC_CHARS = ['◈', '◉', '◎', '◉']

export default function SyncStatus() {
  const { progress, triggerSync } = useMoodleSync()
  const { courses } = useCourses()
  const [charIdx, setCharIdx] = useState(0)
  const [gsConnected, setGsConnected] = useState(false)
  const [gsSyncing, setGsSyncing] = useState(false)
  const [gsError, setGsError] = useState(false)

  const lastSynced = courses[0]?.last_synced_at
  const isSyncing = progress.status === 'syncing' || progress.status === 'parsing'

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('users').select('gradescope_connected').eq('id', user.id).single()
        .then(({ data }) => { if (data?.gradescope_connected) setGsConnected(true) })
    })
  }, [])

  useEffect(() => {
    if (!isSyncing && !gsSyncing) return
    const iv = setInterval(() => setCharIdx(i => (i + 1) % SYNC_CHARS.length), 200)
    return () => clearInterval(iv)
  }, [isSyncing, gsSyncing])

  async function triggerGsSync() {
    setGsSyncing(true)
    setGsError(false)
    const { data, error } = await supabase.functions.invoke('sync-gradescope')
    setGsSyncing(false)
    if (error || data?.error) setGsError(true)
  }

  const base: React.CSSProperties = {
    fontFamily: 'var(--font-mono)',
    fontSize: '10px',
    letterSpacing: '0.08em',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    whiteSpace: 'nowrap' as const,
  }

  const syncBtnStyle: React.CSSProperties = {
    fontFamily: 'var(--font-mono)',
    fontSize: '10px',
    color: 'var(--text-dim)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    letterSpacing: '0.08em',
    transition: 'color 0.2s',
  }

  if (isSyncing || gsSyncing) {
    return (
      <div style={base}>
        <span style={{ color: 'var(--accent-cyan)', fontSize: '12px' }}>{SYNC_CHARS[charIdx]}</span>
        <span style={{ color: 'var(--accent-cyan)' }}>
          {gsSyncing && !isSyncing ? 'GS SYNC...' : 'SYNCING...'}
        </span>
      </div>
    )
  }

  if (progress.status === 'error') {
    return (
      <div style={{ ...base, gap: '8px' }}>
        <span className="amber-pulse" style={{ color: 'var(--accent-amber)', fontSize: '10px' }}>▲</span>
        <span className="amber-pulse" style={{ color: 'var(--accent-amber)' }}>SYNC FAILED</span>
        <button onClick={triggerSync} style={{ ...syncBtnStyle, textDecoration: 'underline' }}>
          RETRY
        </button>
      </div>
    )
  }

  return (
    <div style={{ ...base, gap: '8px' }}>
      {lastSynced && (
        <span style={{ color: 'var(--text-dim)' }}>
          <span style={{ color: 'var(--accent-green)', marginRight: '5px', fontSize: '8px' }}>●</span>
          SYNCED {formatDistanceToNow(new Date(lastSynced)).toUpperCase()} AGO
        </span>
      )}
      <button
        onClick={triggerSync}
        style={syncBtnStyle}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent-cyan)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-dim)')}
      >
        [ SYNC ]
      </button>
      {gsConnected && (
        <button
          onClick={triggerGsSync}
          style={{
            ...syncBtnStyle,
            color: gsError ? 'var(--accent-amber)' : 'var(--text-dim)',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent-green)')}
          onMouseLeave={e => (e.currentTarget.style.color = gsError ? 'var(--accent-amber)' : 'var(--text-dim)')}
          title={gsError ? 'Gradescope sync failed — click to retry' : 'Sync Gradescope assignments'}
        >
          {gsError ? '[ GS ▲ ]' : '[ GS ]'}
        </button>
      )}
    </div>
  )
}
