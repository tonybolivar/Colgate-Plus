import { useEffect, useState, useRef } from 'react'
import { generateBriefing } from '../../lib/briefing'
import type { Assignment } from '../../types'

interface Props {
  assignments: Assignment[]
  firstName: string
}

export default function Briefing({ assignments, firstName }: Props) {
  const [text, setText] = useState('')
  const [displayed, setDisplayed] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [glitch, setGlitch] = useState(false)
  const [time, setTime] = useState(new Date())
  const cancelRef = useRef(false)

  // Live clock
  useEffect(() => {
    const iv = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(iv)
  }, [])

  useEffect(() => {
    if (assignments.length === 0) { setLoading(false); return }
    cancelRef.current = false

    async function fetchBriefing() {
      try {
        const briefing = await generateBriefing(assignments, firstName)
        if (!cancelRef.current) {
          setText(briefing)
          setGlitch(true)
          setTimeout(() => setGlitch(false), 450)
        }
      } catch {
        if (!cancelRef.current) setError(true)
      } finally {
        if (!cancelRef.current) setLoading(false)
      }
    }

    fetchBriefing()
    return () => { cancelRef.current = true }
  }, [assignments.length, firstName])

  // Jittery typewriter
  useEffect(() => {
    if (!text) return
    let cancelled = false
    let idx = 0
    setDisplayed('')

    function typeNext() {
      if (cancelled) return
      idx += 1
      setDisplayed(text.slice(0, idx))
      if (idx < text.length) {
        const delay = 8 + Math.random() * 28
        setTimeout(typeNext, delay)
      }
    }
    typeNext()
    return () => { cancelled = true }
  }, [text])

  const timeStr = time.toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  })
  const dateStr = time.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  }).toUpperCase()

  return (
    <div
      className="hud-panel animate-in"
      style={{ padding: '20px 24px', marginBottom: '24px' }}
    >
      <span className="hud-corner-tr" />
      <span className="hud-corner-bl" />

      {/* Header row */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '14px',
      }}>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '10px',
          color: 'var(--accent-cyan)',
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
        }}>
          // SYSTEM BRIEFING
        </span>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '10px',
          color: 'var(--text-dim)',
          letterSpacing: '0.08em',
        }}>
          [ {dateStr} · {timeStr} ]
        </span>
      </div>

      {/* Content */}
      <div style={{ minHeight: '52px', display: 'flex', alignItems: 'center' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
            {[0.9, 0.7, 0.5].map((w, i) => (
              <div key={i} style={{
                height: '3px',
                background: 'var(--border-default)',
                borderRadius: '2px',
                overflow: 'hidden',
                width: `${w * 100}%`,
              }}>
                <div style={{
                  height: '100%',
                  background: 'var(--accent-cyan)',
                  animation: `radar-sweep ${1.4 + i * 0.3}s ease-in-out infinite`,
                  animationDelay: `${i * 0.2}s`,
                  transformOrigin: 'left center',
                }} />
              </div>
            ))}
          </div>
        ) : error ? (
          <p style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '13px',
            color: 'var(--text-dim)',
            fontStyle: 'italic',
          }}>
            BRIEFING UNAVAILABLE — MANUAL REVIEW REQUIRED
          </p>
        ) : (
          <p
            className={glitch ? 'glitch-in' : ''}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '14px',
              lineHeight: '1.75',
              color: 'var(--text-primary)',
              letterSpacing: '0.01em',
            }}
          >
            {displayed}
            {displayed.length < text.length && (
              <span style={{
                display: 'inline-block',
                width: '9px',
                height: '15px',
                background: 'var(--accent-cyan)',
                marginLeft: '2px',
                verticalAlign: 'middle',
                animation: 'blink-cursor 0.8s step-start infinite',
                opacity: 0.9,
              }} />
            )}
          </p>
        )}
      </div>
    </div>
  )
}
