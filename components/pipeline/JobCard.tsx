'use client'
import { useState } from 'react'
import type { Job, JobStatus, RegionConfig, RoleConfig } from '@/lib/storage'
import { FitBreakdown } from '@/components/FitBreakdown'
import { STATUS_CONFIG, primaryBtn, ghostBtn, sectionLabel, locationBadgeStyle, ScoreBadge, KeywordBox } from '@/components/ui'

// ── Job Card ──────────────────────────────────────────
export function JobCard({ job, onStatusChange, onDelete, onDescriptionUpdate, onChecklistUpdate, personaId, fw, regions, roles }: {
  job: Job; personaId: string; fw: Function
  regions: RegionConfig[]; roles: RoleConfig[]
  onStatusChange: (id: string, status: JobStatus) => void
  onDelete: (id: string) => void
  onDescriptionUpdate: (id: string, description: string) => void
  onChecklistUpdate: (id: string, checklist: Job['checklist']) => void
}) {
  const cfg = STATUS_CONFIG[job.status]
  const [expanded, setExpanded] = useState(false)
  const [showChecklist, setShowChecklist] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [fetchError, setFetchError] = useState('')
  const [exporting, setExporting] = useState(false)
  const [exportMsg, setExportMsg] = useState('')

  const checklist = job.checklist || []
  const doneCount = checklist.filter(c => c.done).length

  const exportPDF = async () => {
    setExporting(true); setExportMsg('')
    try {
      const res = await fw('/api/export/pdf', { method: 'POST', body: JSON.stringify({ jobId: job.id, personaId }) })
      const data = await res.json()
      if (data.error) setExportMsg('Error: ' + data.error)
      else setExportMsg(`Saved: ${data.filename}`)
    } catch { setExportMsg('Export failed.') }
    setExporting(false)
  }

  const loadFullDescription = async () => {
    if (!job.url) return
    setFetching(true); setFetchError('')
    try {
      const res = await fw('/api/fetch-description', { method: 'POST', body: JSON.stringify({ url: job.url }) })
      const data = await res.json()
      if (data.error) setFetchError(data.error)
      else { await fw('/api/jobs', { method: 'PUT', body: JSON.stringify({ id: job.id, description: data.description }) }); onDescriptionUpdate(job.id, data.description) }
    } catch { setFetchError('Failed to fetch.') }
    setFetching(false)
  }

  const toggleChecklistItem = (itemId: string) => {
    const updated = checklist.map(c => c.id === itemId ? { ...c, done: !c.done } : c)
    onChecklistUpdate(job.id, updated)
  }

  const region = regions.find(r => r.id === job.regionId)
  const role = roles.find(r => r.id === job.roleId)

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, transition: 'border-color 0.15s' }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
      <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: 15, color: 'var(--text)' }}>{job.title}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <span style={{ color: 'var(--muted)', fontSize: 13 }}>{job.company}</span>
            {job.location && (
              <span style={{ fontSize: 11, borderRadius: 4, padding: '1px 7px', fontFamily: 'DM Mono, monospace', ...locationBadgeStyle(job.location) }}>{job.location}</span>
            )}
            {region && <span style={{ fontSize: 11, background: '#eeedff', border: '1px solid var(--accent)33', borderRadius: 4, padding: '1px 6px', color: 'var(--accent)', fontFamily: 'DM Mono, monospace' }}>{region.name}</span>}
            {role && <span style={{ fontSize: 11, background: '#fff8e0', border: '1px solid var(--accent2)33', borderRadius: 4, padding: '1px 6px', color: 'var(--accent2)', fontFamily: 'DM Mono, monospace' }}>{role.name}</span>}
          </div>
        </div>

        {job.postingFlags?.some(f => f.severity === 'warning') && (
          <span title={job.postingFlags.map(f => f.detail).join('\n')} style={{ fontSize: 11, fontFamily: 'DM Mono, monospace', padding: '4px 8px', borderRadius: 8, color: '#a06000', background: '#fff4e5', border: '1px solid #e0a04066', whiteSpace: 'nowrap' }}>⚠ POSTING</span>
        )}
        {job.fitScore !== undefined ? (
          <ScoreBadge score={job.fitScore} />
        ) : !job.description?.trim() ? (
          <span style={{ fontSize: 11, fontFamily: 'DM Mono, monospace', padding: '4px 10px', borderRadius: 8, color: 'var(--muted)', background: 'var(--surface2)', border: '1px solid var(--border)', whiteSpace: 'nowrap' }}>NO DESC</span>
        ) : null}

        {checklist.length > 0 && (
          <button onClick={() => setShowChecklist(v => !v)} style={{ ...ghostBtn, padding: '4px 10px', fontSize: 11, whiteSpace: 'nowrap', color: doneCount === checklist.length ? 'var(--accent3)' : 'var(--muted)' }}>
            ✓ {doneCount}/{checklist.length}
          </button>
        )}

        <select value={job.status} onChange={e => onStatusChange(job.id, e.target.value as JobStatus)} style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}66`, borderRadius: 8, padding: '4px 10px', fontSize: 12, fontFamily: 'DM Mono, monospace', cursor: 'pointer', letterSpacing: '0.06em' }}>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>

        <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'DM Mono, monospace', whiteSpace: 'nowrap' }}>{new Date(job.createdAt).toLocaleDateString()}</div>
        <button onClick={() => setExpanded(v => !v)} style={{ ...ghostBtn, fontSize: 11, padding: '3px 8px', whiteSpace: 'nowrap' }}>{expanded ? 'Hide ▲' : 'Details ▼'}</button>
        <button onClick={() => onDelete(job.id)} style={{ background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '2px 4px', borderRadius: 4 }} title="Delete">×</button>
      </div>

      {/* Checklist panel */}
      {showChecklist && checklist.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={sectionLabel}>APPLICATION CHECKLIST</div>
          {checklist.map(item => (
            <label key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, color: item.done ? 'var(--muted)' : 'var(--text)', textDecoration: item.done ? 'line-through' : 'none' }}>
              <input type="checkbox" checked={item.done} onChange={() => toggleChecklistItem(item.id)} style={{ accentColor: 'var(--accent)', width: 16, height: 16, cursor: 'pointer' }} />
              {item.item}
            </label>
          ))}
        </div>
      )}

      {/* Expanded panel */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            {job.url && <a href={job.url} target="_blank" rel="noopener noreferrer" style={{ ...primaryBtn, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>↗ View Posting</a>}
            {job.atsAnalysis && <button onClick={exportPDF} disabled={exporting} style={{ ...ghostBtn, color: '#7c6fe8', borderColor: '#7c6fe8', opacity: exporting ? 0.6 : 1 }}>{exporting ? 'Exporting…' : '↓ Export PDF'}</button>}
            {exportMsg && <span style={{ fontSize: 12, fontFamily: 'DM Mono, monospace', color: exportMsg.startsWith('Error') ? 'var(--danger)' : 'var(--accent3)' }}>{exportMsg}</span>}
          </div>
          {(job.rubric || job.postingFlags?.length) ? (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
              <FitBreakdown rubric={job.rubric} flags={job.postingFlags} />
              {job.atsAnalysis && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                  <KeywordBox title="✓ Matched" keywords={job.atsAnalysis.matchedKeywords} color="var(--accent3)" bg="#e6f7f0" />
                  <KeywordBox title="✕ Missing" keywords={job.atsAnalysis.missingKeywords} color="var(--danger)" bg="#fff0ec" />
                </div>
              )}
            </div>
          ) : null}
          {job.description?.trim() ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={sectionLabel}>JOB DESCRIPTION</div>
                {job.url && <button onClick={loadFullDescription} disabled={fetching} style={{ ...ghostBtn, fontSize: 11, padding: '3px 10px', opacity: fetching ? 0.6 : 1 }}>{fetching ? 'Loading…' : '↻ Reload'}</button>}
              </div>
              {fetchError && <p style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 8 }}>{fetchError}</p>}
              <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '14px 18px' }}>
                <FormatDescription text={job.description} />
              </div>
            </div>
          ) : (
            <div>
              <p style={{ fontSize: 13, color: 'var(--muted)', fontStyle: 'italic', marginBottom: 10 }}>No description stored.</p>
              {job.url && <button onClick={loadFullDescription} disabled={fetching} style={{ ...primaryBtn, opacity: fetching ? 0.6 : 1 }}>{fetching ? 'Fetching…' : '↻ Load Full Description'}</button>}
              {fetchError && <p style={{ fontSize: 12, color: 'var(--danger)', marginTop: 8 }}>{fetchError}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Job description formatter ─────────────────────────
export function FormatDescription({ text }: { text: string }) {
  if (!text?.trim()) return null
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  let listItems: string[] = []

  const flushList = () => {
    if (listItems.length) {
      elements.push(
        <ul key={elements.length} style={{ margin: '6px 0 10px 0', paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 3 }}>
          {listItems.map((item, i) => <li key={i} style={{ fontSize: 13, lineHeight: 1.65, color: 'var(--text)' }}>{item}</li>)}
        </ul>
      )
      listItems = []
    }
  }

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) { flushList(); continue }

    const isBullet = /^[-•*·▸►]/.test(line) || /^\d+[.)]\s/.test(line)
    const isHeader = (line === line.toUpperCase() && line.length > 4 && /[A-Z]/.test(line)) || line.endsWith(':')

    if (isBullet) {
      listItems.push(line.replace(/^[-•*·▸►]\s*/, '').replace(/^\d+[.)]\s*/, ''))
    } else if (isHeader) {
      flushList()
      elements.push(<div key={elements.length} style={{ fontSize: 11, fontFamily: 'DM Mono, monospace', letterSpacing: '0.08em', color: 'var(--accent)', textTransform: 'uppercase', marginTop: 14, marginBottom: 4 }}>{line.replace(/:$/, '')}</div>)
    } else {
      flushList()
      elements.push(<p key={elements.length} style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text)', margin: '4px 0' }}>{line}</p>)
    }
  }
  flushList()
  return <div>{elements}</div>
}
