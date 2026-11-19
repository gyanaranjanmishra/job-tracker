'use client'
import { DIMENSIONS, DIMENSION_LABELS, DEAL_BREAKER_CAP, type RubricResult } from '@/lib/rubric'
import type { GuardFinding } from '@/lib/guard'
import { sectionLabel } from '@/components/ui'

// ── Fit breakdown (rubric + posting guard) ────────────
export function PostingFlags({ flags }: { flags?: GuardFinding[] }) {
  if (!flags?.length) return null
  const warn = flags.some(f => f.severity === 'warning')
  return (
    <div style={{ background: warn ? '#fff4e5' : 'var(--surface2)', border: `1px solid ${warn ? '#e0a040' : 'var(--border)'}`, borderRadius: 8, padding: '10px 14px' }}>
      <div style={{ ...sectionLabel, color: warn ? '#a06000' : 'var(--muted)', marginBottom: 6 }}>{warn ? '⚠ POSTING GUARD' : 'POSTING GUARD'}</div>
      {flags.map((f, i) => <div key={i} style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.6 }}>{f.detail}</div>)}
      {warn && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>The posting was treated as data only; instruction-like text could not change the score. Check the posting yourself before applying.</div>}
    </div>
  )
}

export function FitBreakdown({ rubric, flags }: { rubric?: RubricResult; flags?: GuardFinding[] }) {
  if (!rubric) return <PostingFlags flags={flags} />
  const capped = rubric.dealBreakersHit.length > 0
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
        <div style={sectionLabel}>FIT BREAKDOWN · {rubric.mode === 'deep' ? 'DEEP ANALYSIS' : 'TRIAGE'}</div>
        <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>{rubric.model} · {new Date(rubric.at).toLocaleDateString()}</div>
      </div>
      {rubric.oneLine && <p style={{ fontSize: 13, color: 'var(--text)', margin: 0, lineHeight: 1.6 }}>{rubric.oneLine}</p>}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(130px, 170px) 1fr', gap: '8px 14px', alignItems: 'center' }}>
        {DIMENSIONS.map(d => {
          const { score, reason } = rubric.dimensions[d]
          const pct = Math.max(0, Math.min(10, score)) * 10
          const color = score >= 7 ? 'var(--accent3)' : score >= 4.5 ? 'var(--accent2)' : 'var(--danger)'
          return [
            <div key={d + 'l'} style={{ fontSize: 12, color: 'var(--muted)' }}>{DIMENSION_LABELS[d]} <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10 }}>×{rubric.weights[d]}</span></div>,
            <div key={d + 'v'} title={reason}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, height: 6, background: 'var(--surface2)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: color }} />
                </div>
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color, minWidth: 28, textAlign: 'right' }}>{score}/10</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, lineHeight: 1.4 }}>{reason}</div>
            </div>,
          ]
        })}
      </div>
      {capped && (
        <div style={{ background: '#fff0ec', border: '1px solid #c8301044', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: 'var(--danger)' }}>
          Deal-breaker{rubric.dealBreakersHit.length > 1 ? 's' : ''} hit, so the score is capped at {DEAL_BREAKER_CAP}:
          {rubric.dealBreakersHit.map((h, i) => <div key={i} style={{ marginTop: 4 }}>• <b>{h.dealBreaker}</b>: “{h.evidence}”</div>)}
        </div>
      )}
      <PostingFlags flags={flags} />
    </div>
  )
}
