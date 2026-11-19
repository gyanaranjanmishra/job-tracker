'use client'
import { useState, useEffect, useCallback } from 'react'
import type { ResumeEntry, RegionConfig, RoleConfig } from '@/lib/storage'
import { DIMENSIONS, DIMENSION_LABELS, DEAL_BREAKER_CAP, type FitProfile } from '@/lib/rubric'
import { labelStyle, inputStyle, selectStyle, primaryBtn, ghostBtn, dangerBtn, card, Field, EmptyState } from '@/components/ui'

// ── Resume Tab ────────────────────────────────────────
export function ResumeTab({ fw, personaId, regions, roles, onRegionsRolesChange, onProfileChange }: { fw: Function; personaId: string; regions: RegionConfig[]; roles: RoleConfig[]; onRegionsRolesChange: () => void; onProfileChange?: (updatedAt?: string) => void }) {
  const [resumes, setResumes] = useState<ResumeEntry[]>([])
  const [editing, setEditing] = useState<ResumeEntry | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [newForm, setNewForm] = useState({ name: '', regionId: '', roleId: '', text: '' })
  const [saved, setSaved] = useState(false)

  const load = useCallback(() => fw('/api/resumes').then((r: Response) => r.json()).then(setResumes), [personaId])
  useEffect(() => { load() }, [load])

  const saveResume = async (entry: Partial<ResumeEntry> & { id?: string }) => {
    const method = entry.id ? 'PUT' : 'POST'
    await fw('/api/resumes', { method, body: JSON.stringify(entry) })
    load(); setSaved(true); setTimeout(() => setSaved(false), 2000)
    setEditing(null); setShowAdd(false); setNewForm({ name: '', regionId: '', roleId: '', text: '' })
  }

  const deleteResume = async (id: string) => {
    await fw(`/api/resumes?id=${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 20, color: 'var(--text)', marginBottom: 4 }}>Resumes</h2>
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>Manage multiple resumes. Tag each with a region and/or role for auto-selection.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {saved && <span style={{ fontSize: 13, color: 'var(--accent3)' }}>✓ Saved</span>}
          <button onClick={() => setShowAdd(v => !v)} style={primaryBtn}>{showAdd ? 'Cancel' : '+ Add Resume'}</button>
        </div>
      </div>

      {showAdd && (
        <div style={{ ...card, border: '1px solid var(--accent)', marginBottom: 20 }}>
          <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 15, marginBottom: 16, color: 'var(--text)' }}>New Resume</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
            <Field label="Resume Name *" value={newForm.name} onChange={v => setNewForm(f => ({ ...f, name: v }))} placeholder="Canada - Data Analyst" />
            <div>
              <label style={labelStyle}>Region Tag</label>
              <select value={newForm.regionId} onChange={e => setNewForm(f => ({ ...f, regionId: e.target.value }))} style={selectStyle}>
                <option value="">— None —</option>
                {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Role Tag</label>
              <select value={newForm.roleId} onChange={e => setNewForm(f => ({ ...f, roleId: e.target.value }))} style={selectStyle}>
                <option value="">— None —</option>
                {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
          </div>
          <label style={labelStyle}>Resume Text</label>
          <textarea value={newForm.text} onChange={e => setNewForm(f => ({ ...f, text: e.target.value }))} rows={12} placeholder="Paste your full resume text here..." style={{ ...inputStyle, resize: 'vertical', fontFamily: 'DM Mono, monospace', fontSize: 13, lineHeight: 1.8, marginBottom: 12 }} />
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => { if (newForm.name.trim()) saveResume(newForm) }} style={primaryBtn}>Save Resume</button>
            <button onClick={() => { setShowAdd(false); setNewForm({ name: '', regionId: '', roleId: '', text: '' }) }} style={ghostBtn}>Cancel</button>
          </div>
        </div>
      )}

      {resumes.length === 0 && !showAdd ? <EmptyState message="No resumes yet. Add your first resume above." icon="📄" /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {resumes.map(r => (
            <div key={r.id} style={card}>
              {editing?.id === r.id ? (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                    <Field label="Name" value={editing.name} onChange={v => setEditing(e => e ? { ...e, name: v } : e)} placeholder="Resume Name" />
                    <div>
                      <label style={labelStyle}>Region Tag</label>
                      <select value={editing.regionId || ''} onChange={e => setEditing(ed => ed ? { ...ed, regionId: e.target.value } : ed)} style={selectStyle}>
                        <option value="">— None —</option>
                        {regions.map(rg => <option key={rg.id} value={rg.id}>{rg.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Role Tag</label>
                      <select value={editing.roleId || ''} onChange={e => setEditing(ed => ed ? { ...ed, roleId: e.target.value } : ed)} style={selectStyle}>
                        <option value="">— None —</option>
                        {roles.map(ro => <option key={ro.id} value={ro.id}>{ro.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <textarea value={editing.text} onChange={e => setEditing(ed => ed ? { ...ed, text: e.target.value } : ed)} rows={14} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'DM Mono, monospace', fontSize: 13, lineHeight: 1.8, marginBottom: 12 }} />
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={() => saveResume(editing)} style={primaryBtn}>Save Changes</button>
                    <button onClick={() => setEditing(null)} style={ghostBtn}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: 15, color: 'var(--text)', marginBottom: 4 }}>{r.name}</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {r.regionId && <span style={{ fontSize: 11, background: '#eeedff', color: 'var(--accent)', border: '1px solid var(--accent)44', borderRadius: 4, padding: '1px 8px', fontFamily: 'DM Mono, monospace' }}>{regions.find(rg => rg.id === r.regionId)?.name || 'Region'}</span>}
                      {r.roleId && <span style={{ fontSize: 11, background: '#fff8e0', color: 'var(--accent2)', border: '1px solid var(--accent2)44', borderRadius: 4, padding: '1px 8px', fontFamily: 'DM Mono, monospace' }}>{roles.find(ro => ro.id === r.roleId)?.name || 'Role'}</span>}
                      {!r.regionId && !r.roleId && <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>No tags — used as default</span>}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{r.text.slice(0, 100)}{r.text.length > 100 ? '…' : ''}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setEditing(r)} style={ghostBtn}>Edit</button>
                    <button onClick={() => { if (confirm('Delete this resume?')) deleteResume(r.id) }} style={dangerBtn}>Delete</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <FitPreferences fw={fw} personaId={personaId} onSaved={onProfileChange} />
    </div>
  )
}

// ── Fit preferences (rubric config) ───────────────────
export function FitPreferences({ fw, personaId, onSaved }: { fw: Function; personaId: string; onSaved?: (updatedAt?: string) => void }) {
  const [profile, setProfile] = useState<FitProfile | null>(null)
  const [locations, setLocations] = useState('')
  const [dealBreakers, setDealBreakers] = useState('')
  const [status, setStatus] = useState('')

  useEffect(() => {
    fw('/api/profile').then((r: Response) => r.json()).then((p: FitProfile) => {
      setProfile(p)
      setLocations(p.preferredLocations.join(', '))
      setDealBreakers(p.dealBreakers.join('\n'))
    })
  }, [personaId])

  if (!profile) return null
  const weightSum = DIMENSIONS.reduce((s, d) => s + (Number(profile.weights[d]) || 0), 0)

  const save = async () => {
    const body: FitProfile = {
      ...profile,
      preferredLocations: locations.split(',').map(s => s.trim()).filter(Boolean),
      dealBreakers: dealBreakers.split('\n').map(s => s.trim()).filter(Boolean),
    }
    const res = await fw('/api/profile', { method: 'PUT', body: JSON.stringify(body) })
    if (!res.ok) { setStatus('Save failed'); return }
    const saved: FitProfile = await res.json()
    setProfile(saved)
    setStatus('✓ Saved. Jobs scored earlier will be re-triaged.')
    onSaved?.(saved.updatedAt)
    setTimeout(() => setStatus(''), 4000)
  }

  return (
    <div style={{ ...card, marginTop: 28 }}>
      <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 16, color: 'var(--text)', marginBottom: 4 }}>Fit preferences</h3>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16 }}>
        The fit score is a weighted average of five rubric dimensions rated by Claude. A deal-breaker found in a posting caps the score at {DEAL_BREAKER_CAP}. Changing these marks existing scores for re-triage.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <Field label="Target seniority" value={profile.targetSeniority} onChange={v => setProfile({ ...profile, targetSeniority: v })} placeholder="Senior individual contributor" />
        <Field label="Preferred locations / work modes (comma separated)" value={locations} onChange={setLocations} placeholder="Remote, Toronto, Hybrid in London" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div>
          <label style={labelStyle}>Deal-breakers (one per line)</label>
          <textarea value={dealBreakers} onChange={e => setDealBreakers(e.target.value)} rows={4} placeholder={'Requires security clearance\nFully on-site'} style={{ ...inputStyle, resize: 'vertical' }} />
        </div>
        <div>
          <label style={labelStyle}>Career priorities</label>
          <textarea value={profile.priorities} onChange={e => setProfile({ ...profile, priorities: e.target.value })} rows={4} placeholder="Applied ML, product impact, mentoring" style={{ ...inputStyle, resize: 'vertical' }} />
        </div>
      </div>
      <label style={labelStyle}>Weights {weightSum !== 100 && <span style={{ color: 'var(--muted)' }}>(sum {weightSum}; they are normalised)</span>}</label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 14 }}>
        {DIMENSIONS.map(d => (
          <div key={d}>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>{DIMENSION_LABELS[d]}</div>
            <input type="number" min={0} max={100} value={profile.weights[d]} onChange={e => setProfile({ ...profile, weights: { ...profile.weights, [d]: Number(e.target.value) } })} style={inputStyle} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <button onClick={save} style={primaryBtn}>Save preferences</button>
        {status && <span style={{ fontSize: 13, color: 'var(--accent3)' }}>{status}</span>}
      </div>
    </div>
  )
}
