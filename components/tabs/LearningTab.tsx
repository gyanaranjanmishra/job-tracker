'use client'
import { useState, useEffect } from 'react'
import type { RoleConfig } from '@/lib/storage'
import { labelStyle, selectStyle, ghostBtn, card, sectionLabel, EmptyState } from '@/components/ui'

// ── Learning Tab ──────────────────────────────────────
export function LearningTab({ fw, roles }: { fw: Function; roles: RoleConfig[] }) {
  const [selectedRole, setSelectedRole] = useState('')
  const [data, setData] = useState<{ role: string; skills: any[] } | null>(null)

  // Open on the first role instead of an empty picker
  useEffect(() => {
    if (!selectedRole && roles.length) setSelectedRole(roles[0].name)
  }, [roles])
  const [loading, setLoading] = useState(false)
  const [recomputing, setRecomputing] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (!selectedRole) return
    setLoading(true)
    fw(`/api/learning?role=${encodeURIComponent(selectedRole)}`).then((r: Response) => r.json()).then((d: any) => {
      setData(d); setLoading(false)
    })
  }, [selectedRole])

  const recompute = async () => {
    setRecomputing(true)
    const res = await fw('/api/learning', { method: 'POST', body: JSON.stringify({ role: selectedRole || undefined }) })
    const result = await res.json()
    setMsg(`Recomputed from ${result.processed} analyzed jobs`)
    setTimeout(() => setMsg(''), 4000)
    if (selectedRole) {
      fw(`/api/learning?role=${encodeURIComponent(selectedRole)}`).then((r: Response) => r.json()).then(setData)
    }
    setRecomputing(false)
  }

  const missing = data?.skills?.filter(s => s.missingCount > 0).sort((a: any, b: any) => b.missingCount - a.missingCount) || []
  const matched = data?.skills?.filter(s => s.matchedCount > 0 && s.missingCount === 0).sort((a: any, b: any) => b.matchedCount - a.matchedCount) || []

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 20, color: 'var(--text)', marginBottom: 4 }}>Learning Radar</h2>
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>Skills ranked by how often they appear across your analyzed job descriptions, per role.</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {msg && <span style={{ fontSize: 12, color: 'var(--accent3)' }}>{msg}</span>}
          <button onClick={recompute} disabled={recomputing} style={{ ...ghostBtn, opacity: recomputing ? 0.6 : 1 }}>{recomputing ? 'Computing…' : '↻ Recompute'}</button>
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle}>Select Role</label>
        <select value={selectedRole} onChange={e => setSelectedRole(e.target.value)} style={{ ...selectStyle, maxWidth: 300 }}>
          <option value="">— Pick a role —</option>
          {roles.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
        </select>
      </div>

      {roles.length === 0 && (
        <div style={{ ...card, color: 'var(--muted)', fontSize: 13 }}>
          No roles configured yet. Add roles in <strong>Sources → Roles</strong> to enable Learning Radar.
        </div>
      )}

      {selectedRole && loading && <div style={{ color: 'var(--muted)', padding: 20 }}>Loading…</div>}

      {selectedRole && !loading && data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {missing.length > 0 && (
            <div style={card}>
              <div style={{ ...sectionLabel, color: 'var(--danger)' }}>🎯 SKILLS TO DEVELOP — {missing.length} gaps found across {new Set(data.skills.flatMap((s: any) => s.jobIds)).size} job descriptions</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {missing.map((s: any) => (
                  <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff0ec', border: '1px solid #c8301022', borderRadius: 8, padding: '6px 12px' }}>
                    <span style={{ fontSize: 13, fontFamily: 'DM Mono, monospace', color: 'var(--text)' }}>{s.name}</span>
                    <span style={{ fontSize: 11, background: 'var(--danger)', color: '#fff', borderRadius: 99, padding: '1px 7px', fontFamily: 'DM Mono, monospace', fontWeight: 700 }}>{s.missingCount}</span>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 12, fontFamily: 'DM Mono, monospace' }}>Badge = number of job descriptions where this skill is missing from your resume</p>
            </div>
          )}

          {matched.length > 0 && (
            <div style={card}>
              <div style={{ ...sectionLabel, color: 'var(--accent3)' }}>✓ SKILLS YOU HAVE — {matched.length} matched</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {matched.map((s: any) => (
                  <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#e6f7f0', border: '1px solid #0a7a5022', borderRadius: 8, padding: '6px 12px' }}>
                    <span style={{ fontSize: 13, fontFamily: 'DM Mono, monospace', color: 'var(--text)' }}>{s.name}</span>
                    <span style={{ fontSize: 11, background: 'var(--accent3)', color: '#fff', borderRadius: 99, padding: '1px 7px', fontFamily: 'DM Mono, monospace', fontWeight: 700 }}>{s.matchedCount}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!missing.length && !matched.length && (
            <EmptyState message={`No skills data for "${selectedRole}" yet. Analyze jobs first using "Analyze All" in the Pipeline tab.`} icon="🎓" />
          )}
        </div>
      )}

      {!selectedRole && roles.length > 0 && (
        <EmptyState message="Select a role above to see your skill gaps and strengths." icon="🎓" />
      )}
    </div>
  )
}
