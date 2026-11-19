'use client'
import type { CompanyResearch } from '@/lib/research'
import { sectionLabel } from '@/components/ui'

const VERDICT: Record<CompanyResearch['fit']['verdict'], { label: string; color: string; bg: string }> = {
  strong: { label: 'STRONG FIT', color: 'var(--accent3)', bg: '#e6f7f0' },
  mixed: { label: 'MIXED FIT', color: '#a06000', bg: '#fff4e5' },
  weak: { label: 'WEAK FIT', color: 'var(--danger)', bg: '#fff0ec' },
}

const chip = (color: string, bg: string) => ({
  fontSize: 11, fontFamily: 'DM Mono, monospace', padding: '2px 8px', borderRadius: 6, color, background: bg, border: `1px solid ${color}44`,
})

function List({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null
  return (
    <div>
      <div style={{ ...sectionLabel, marginBottom: 6 }}>{title}</div>
      <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {items.map((t, i) => <li key={i} style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--text)' }}>{t}</li>)}
      </ul>
    </div>
  )
}

/** Shows a saved company research review on the job card. */
export function ResearchPanel({ research }: { research: CompanyResearch }) {
  const v = VERDICT[research.fit.verdict]
  const host = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url } }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        <div style={sectionLabel}>COMPANY RESEARCH</div>
        <span style={chip(v.color, v.bg)}>{v.label}</span>
        {research.confidence === 'low' && <span title="Little was found, or it may describe a different company with a similar name." style={chip('#a06000', '#fff4e5')}>LOW CONFIDENCE</span>}
        <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>
          {research.searches} searches · {research.fetches} pages · {research.model} · {new Date(research.at).toLocaleDateString()}
        </span>
      </div>
      <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text)', margin: 0 }}>{research.overview}</p>
      {research.recentNews.length > 0 && (
        <div>
          <div style={{ ...sectionLabel, marginBottom: 6 }}>RECENT NEWS</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {research.recentNews.map((n, i) => (
              <div key={i} style={{ fontSize: 13, lineHeight: 1.5 }}>
                <strong>{n.headline}</strong>{n.when && <span style={{ color: 'var(--muted)' }}> · {n.when}</span>}
                <div style={{ color: 'var(--muted)' }}>{n.detail}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      <List title="WHY IT FITS (OR DOESN'T)" items={research.fit.reasons} />
      <List title="TALKING POINTS" items={research.talkingPoints} />
      <List title="CONCERNS" items={research.concerns} />
      <List title="COVER LETTER ADVICE" items={research.letterAdvice} />
      <List title="QUESTIONS TO ASK" items={research.questionsToAsk} />
      {research.sources.length > 0 && (
        <div>
          <div style={{ ...sectionLabel, marginBottom: 6 }}>SOURCES</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {research.sources.map(s => (
              <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer nofollow" title={s.title}
                style={{ fontSize: 11, fontFamily: 'DM Mono, monospace', color: 'var(--accent)', textDecoration: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 8px' }}>
                ↗ {host(s.url)}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
