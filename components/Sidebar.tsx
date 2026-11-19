'use client'
import type { Job, RegionConfig, RoleConfig } from '@/lib/storage'
import { selectStyle } from '@/components/ui'

// ── Sidebar ───────────────────────────────────────────
export function Sidebar({ jobs, regions, roles, personaName, open, onToggle, filterRegionId, filterRoleId, onFilterRegion, onFilterRole }: {
  jobs: Job[]; regions: RegionConfig[]; roles: RoleConfig[]
  personaName: string; open: boolean; onToggle: () => void
  filterRegionId: string; filterRoleId: string
  onFilterRegion: (id: string) => void; onFilterRole: (id: string) => void
}) {
  const now = Date.now()
  const age = (j: Job) => (now - new Date(j.createdAt).getTime()) / 86400000

  const fresh    = jobs.filter(j => age(j) < 1)
  const recent   = jobs.filter(j => age(j) >= 1 && age(j) < 3)
  const thisWeek = jobs.filter(j => age(j) >= 3 && age(j) < 7)
  const old      = jobs.filter(j => age(j) >= 7)

  const buckets = [
    { label: 'Fresh', sub: '< 1 day', jobs: fresh, color: 'var(--accent3)', dot: '#0a7a50' },
    { label: 'Recent', sub: '1–3 days', jobs: recent, color: 'var(--accent)', dot: 'var(--accent)' },
    { label: 'This Week', sub: '3–7 days', jobs: thisWeek, color: 'var(--accent2)', dot: 'var(--accent2)' },
    { label: 'Old', sub: '> 7 days', jobs: old, color: 'var(--muted)', dot: 'var(--border)' },
  ]

  if (!open) {
    return (
      <div style={{ width: 36, flexShrink: 0, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 20, gap: 12 }}>
        <button onClick={onToggle} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 18, padding: 4 }} title="Open sidebar">›</button>
        {buckets.map(b => b.jobs.length > 0 && (
          <div key={b.label} style={{ width: 6, height: 6, borderRadius: '50%', background: b.dot }} title={`${b.label}: ${b.jobs.length}`} />
        ))}
      </div>
    )
  }

  return (
    <div style={{ width: 240, flexShrink: 0, borderRight: '1px solid var(--border)', padding: '20px 0', display: 'flex', flexDirection: 'column', gap: 0, position: 'sticky', top: 60, height: 'calc(100vh - 60px)', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 16px 16px', borderBottom: '1px solid var(--border)' }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'DM Mono, monospace', letterSpacing: '0.08em' }}>PROFILE</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', fontFamily: 'Syne, sans-serif', marginTop: 2 }}>{personaName}</div>
        </div>
        <button onClick={onToggle} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 18, padding: 4 }} title="Close sidebar">‹</button>
      </div>

      {/* Context filters */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'DM Mono, monospace', letterSpacing: '0.08em', marginBottom: 10 }}>FILTER BY</div>
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4, fontFamily: 'DM Mono, monospace' }}>REGION</div>
          <select value={filterRegionId} onChange={e => onFilterRegion(e.target.value)} style={{ ...selectStyle, fontSize: 12, padding: '6px 10px' }}>
            <option value="">All regions</option>
            {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
        <div>
          <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4, fontFamily: 'DM Mono, monospace' }}>ROLE</div>
          <select value={filterRoleId} onChange={e => onFilterRole(e.target.value)} style={{ ...selectStyle, fontSize: 12, padding: '6px 10px' }}>
            <option value="">All roles</option>
            {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
      </div>

      {/* Age buckets */}
      <div style={{ padding: '14px 16px' }}>
        <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'DM Mono, monospace', letterSpacing: '0.08em', marginBottom: 12 }}>JOB AGE</div>
        {buckets.map(b => (
          <div key={b.label} style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: b.dot, flexShrink: 0, display: 'inline-block' }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: b.jobs.length ? 'var(--text)' : 'var(--muted)', fontFamily: 'DM Sans, sans-serif' }}>{b.label}</span>
              </div>
              <span style={{ fontSize: 11, color: b.color, fontFamily: 'DM Mono, monospace', fontWeight: 700 }}>{b.jobs.length}</span>
            </div>
            {b.jobs.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, paddingLeft: 14 }}>
                {b.jobs.slice(0, 4).map(j => (
                  <div key={j.id} style={{ fontSize: 11, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`${j.title} @ ${j.company}`}>
                    {j.title}
                  </div>
                ))}
                {b.jobs.length > 4 && <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>+{b.jobs.length - 4} more</div>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
