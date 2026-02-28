import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase/client'
import type { PortalLink } from '../../types'

export default function PortalLinks() {
  const [links, setLinks] = useState<PortalLink[]>([])

  useEffect(() => {
    supabase.from('portal_links').select('*').order('sort_order').then(({ data }) => {
      if (data) setLinks(data)
    })
  }, [])

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
        // PORTAL ACCESS
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {links.map((link, i) => (
          <a
            key={link.id}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              color: 'var(--text-secondary)',
              textDecoration: 'none',
              padding: '8px 4px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              letterSpacing: '0.06em',
              borderTop: i === 0 ? 'none' : '1px solid var(--border-default)',
              transition: 'color 0.2s ease',
            }}
            onMouseEnter={e => {
              const el = e.currentTarget
              el.style.color = 'var(--accent-cyan)'
              const arrow = el.querySelector('.arrow') as HTMLElement
              if (arrow) arrow.style.transform = 'translateX(3px)'
            }}
            onMouseLeave={e => {
              const el = e.currentTarget
              el.style.color = 'var(--text-secondary)'
              const arrow = el.querySelector('.arrow') as HTMLElement
              if (arrow) arrow.style.transform = 'translateX(0)'
            }}
          >
            <span
              className="arrow"
              style={{
                display: 'inline-block',
                transition: 'transform 0.2s ease',
                color: 'var(--accent-cyan)',
                fontSize: '10px',
                flexShrink: 0,
              }}
            >
              →
            </span>
            {link.label.toUpperCase()}
          </a>
        ))}
      </div>
    </div>
  )
}
