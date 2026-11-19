'use client'
import type { JobStatus } from '@/lib/storage'

// ── Status config (light theme) ────────────────────────
export const STATUS_CONFIG: Record<JobStatus, { label: string; color: string; bg: string }> = {
  saved:     { label: 'Saved',     color: '#707090', bg: '#f0f0fa' },
  applied:   { label: 'Applied',   color: '#5b53e8', bg: '#eeedff' },
  interview: { label: 'Interview', color: '#b07800', bg: '#fff8e0' },
  offer:     { label: 'Offer',     color: '#0a7a50', bg: '#e6f7f0' },
  rejected:  { label: 'Rejected',  color: '#c83010', bg: '#fff0ec' },
}

// ── Shared styles ──────────────────────────────────────
export const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontFamily: 'DM Mono, monospace',
  letterSpacing: '0.1em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 6,
}

export const inputStyle: React.CSSProperties = {
  background: 'var(--surface2)', border: '1px solid var(--border)',
  borderRadius: 8, padding: '10px 14px', color: 'var(--text)',
  fontSize: 14, fontFamily: 'DM Sans, sans-serif', outline: 'none', width: '100%',
}

export const selectStyle: React.CSSProperties = { ...inputStyle, cursor: 'pointer' }

export const primaryBtn: React.CSSProperties = {
  background: 'var(--accent)', color: '#fff', border: 'none',
  borderRadius: 8, padding: '10px 20px', fontFamily: 'DM Sans, sans-serif',
  fontSize: 13, fontWeight: 500, cursor: 'pointer',
}

export const ghostBtn: React.CSSProperties = {
  background: 'transparent', color: 'var(--muted)',
  border: '1px solid var(--border)', borderRadius: 8,
  padding: '8px 16px', fontFamily: 'DM Sans, sans-serif', fontSize: 13, cursor: 'pointer',
}

export const dangerBtn: React.CSSProperties = {
  background: 'transparent', color: 'var(--danger)',
  border: '1px solid var(--danger)', borderRadius: 8,
  padding: '6px 14px', fontFamily: 'DM Sans, sans-serif', fontSize: 12, cursor: 'pointer',
}

export const card: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20,
}

export const sectionLabel: React.CSSProperties = {
  fontSize: 11, color: 'var(--muted)', fontFamily: 'DM Mono, monospace',
  letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: 14,
}

// ── Input helper ──────────────────────────────────────
export function Field({ label, value, onChange, placeholder, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} />
    </div>
  )
}

export function EmptyState({ message, icon = '📋' }: { message: string; icon?: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)', fontSize: 14 }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>{icon}</div>{message}
    </div>
  )
}

export function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} style={{
      width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', flexShrink: 0,
      background: on ? 'var(--accent)' : 'var(--border)', position: 'relative', transition: 'background 0.2s',
    }}>
      <span style={{
        position: 'absolute', top: 3, left: on ? 22 : 3,
        width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.2s',
      }} />
    </button>
  )
}

// ── Progress Bar ──────────────────────────────────────
export function ProgressBar({ label, progress, total, color }: { label: string; progress: number; total: number; color: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      {label && <div style={{ display: 'flex', justifyContent: 'space-between', ...sectionLabel, marginBottom: 6 }}><span>{label}</span><span>{progress}/{total}</span></div>}
      <div style={{ background: 'var(--border)', borderRadius: 99, height: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 99, background: color, width: `${total > 0 ? (progress / total) * 100 : 0}%`, transition: 'width 0.3s ease' }} />
      </div>
    </div>
  )
}

// ── Location badge helper ─────────────────────────────
export function locationBadgeStyle(loc: string): React.CSSProperties {
  if (/canada|ontario|toronto|vancouver|montreal|calgary|ottawa|bc\b|alberta/i.test(loc))
    return { color: '#b03020', background: '#fdf0ef', border: '1px solid #b0302033' }
  if (/india|bengaluru|bangalore|mumbai|delhi|hyderabad|chennai|pune|noida|gurugram/i.test(loc))
    return { color: '#b06000', background: '#fef5e7', border: '1px solid #b0600033' }
  if (/remote|anywhere|worldwide|global|distributed/i.test(loc))
    return { color: '#1060a0', background: '#eaf4fb', border: '1px solid #1060a033' }
  return { color: 'var(--muted)', background: 'var(--surface2)', border: '1px solid var(--border)' }
}

// ── Score Badge ───────────────────────────────────────
export function ScoreBadge({ score }: { score: number }) {
  const high = score >= 70, mid = score >= 45
  const color = high ? 'var(--accent3)' : mid ? 'var(--accent2)' : 'var(--danger)'
  const bg = high ? '#e6f7f0' : mid ? '#fff8e0' : '#fff0ec'
  const border = high ? '#0a7a5044' : mid ? '#b0780044' : '#c8301044'
  return (
    <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 15, minWidth: 44, textAlign: 'center', padding: '4px 10px', borderRadius: 8, color, background: bg, border: `1px solid ${border}` }} title="Resume fit score">{score}</div>
  )
}

export function KeywordBox({ title, keywords, color, bg }: { title: string; keywords: string[]; color: string; bg: string }) {
  return (
    <div style={card}>
      <div style={{ fontSize: 12, color, fontFamily: 'DM Mono, monospace', letterSpacing: '0.08em', marginBottom: 12 }}>{title}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {keywords?.map((kw, i) => <span key={i} style={{ background: bg, color, border: `1px solid ${color}44`, borderRadius: 6, padding: '3px 10px', fontSize: 12, fontFamily: 'DM Mono, monospace' }}>{kw}</span>)}
        {(!keywords?.length) && <span style={{ color: 'var(--muted)', fontSize: 13 }}>None found</span>}
      </div>
    </div>
  )
}
