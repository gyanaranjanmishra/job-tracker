'use client'
import { useState, useEffect, useCallback } from 'react'
import type { ResumeEntry, RegionConfig, RoleConfig } from '@/lib/storage'
import { DIMENSIONS, DIMENSION_LABELS, DEAL_BREAKER_CAP, type FitProfile } from '@/lib/rubric'
import { labelStyle, inputStyle, selectStyle, primaryBtn, ghostBtn, dangerBtn, card, Field, EmptyState } from '@/components/ui'

// Same list as RESUME_EXTENSIONS in lib/resumeParse.ts (not imported: that module is server-only)
const RESUME_ACCEPT = '.pdf,.docx,.txt,.md'

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

  // Upload a resume file and fill the form with its text for review before saving
  const [importing, setImporting] = useState(false)
  const [importNote, setImportNote] = useState<{ error?: string; warnings?: string[]; source?: string } | null>(null)
  const importFile = async (file: File | undefined, apply: (text: string, name: string) => void) => {
    if (!file) return
    setImporting(true); setImportNote(null)
    try {
      const body = new FormData()
      body.append('file', file)
      const res = await fw('/api/resumes/parse', { method: 'POST', body })
      const data = await res.json()
      if (!res.ok) setImportNote({ error: data.error || 'Could not read that file.' })
      else {
        apply(data.text, data.name)
        const words = data.text.split(/\s+/).filter(Boolean).length
        setImportNote({ warnings: data.warnings, source: `${file.name}: ${words} words${data.pages ? ` from ${data.pages} page${data.pages === 1 ? '' : 's'}` : ''}. Review the text, then save.` })
      }
    } catch { setImportNote({ error: 'Upload failed.' }) }
    setImporting(false)
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
          {/* Upload straight from the header: opens the New Resume form filled with the extracted text */}
          <label title="PDF, Word (.docx) or text file, up to 5 MB" style={{ ...ghostBtn, display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', cursor: importing ? 'wait' : 'pointer', opacity: importing ? 0.6 : 1 }}>
            {importing ? 'Reading file…' : '⇪ Upload resume file'}
            <input type="file" accept={RESUME_ACCEPT} style={{ display: 'none' }} disabled={importing}
              onChange={e => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (!file) return
                setEditing(null)
                setShowAdd(true)
                importFile(file, (text, name) => setNewForm(prev => ({ ...prev, text, name: prev.name.trim() ? prev.name : name })))
              }} />
          </label>
          <button onClick={() => setShowAdd(v => !v)} style={{ ...primaryBtn, whiteSpace: 'nowrap' }}>{showAdd ? 'Cancel' : '+ Add Resume'}</button>
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
          <ResumeFilePicker importing={importing} note={importNote}
            onFile={f => importFile(f, (text, name) => setNewForm(prev => ({ ...prev, text, name: prev.name.trim() ? prev.name : name })))} />
          <label style={labelStyle}>Resume Text</label>
          <textarea value={newForm.text} onChange={e => setNewForm(f => ({ ...f, text: e.target.value }))} rows={12} placeholder="Choose a file above, or paste your full resume text here..." style={{ ...inputStyle, resize: 'vertical', fontFamily: 'DM Mono, monospace', fontSize: 13, lineHeight: 1.8, marginBottom: 12 }} />
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => { if (newForm.name.trim()) { saveResume(newForm); setImportNote(null) } }} disabled={!newForm.name.trim() || !newForm.text.trim()} style={{ ...primaryBtn, opacity: newForm.name.trim() && newForm.text.trim() ? 1 : 0.5 }}>Save Resume</button>
            <button onClick={() => { setShowAdd(false); setImportNote(null); setNewForm({ name: '', regionId: '', roleId: '', text: '' }) }} style={ghostBtn}>Cancel</button>
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
                  <ResumeFilePicker importing={importing} note={importNote} label="Replace text from a file"
                    onFile={f => importFile(f, text => setEditing(ed => ed ? { ...ed, text } : ed))} />
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

// ── Resume file picker ────────────────────────────────
export function ResumeFilePicker({ onFile, importing, note, label = 'Choose a resume file' }: {
  onFile: (f: File | undefined) => void
  importing: boolean
  note: { error?: string; warnings?: string[]; source?: string } | null
  label?: string
}) {
  const [dragging, setDragging] = useState(false)
  return (
    <div style={{ marginBottom: 12 }}>
      <label
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); onFile(e.dataTransfer.files?.[0]) }}
        style={{
          display: 'flex', alignItems: 'center', gap: 12, cursor: importing ? 'wait' : 'pointer',
          border: `1px dashed ${dragging ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 8, padding: '10px 14px',
          background: dragging ? '#eeedff' : 'var(--surface2)',
        }}>
        <input type="file" accept={RESUME_ACCEPT} style={{ display: 'none' }} disabled={importing}
          onChange={e => { onFile(e.target.files?.[0]); e.target.value = '' }} />
        <span style={{ ...ghostBtn, fontSize: 12, padding: '5px 12px', pointerEvents: 'none', whiteSpace: 'nowrap' }}>{importing ? 'Reading…' : `📎 ${label}`}</span>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>PDF, Word (.docx) or text, up to 5 MB. Or drop a file here. The text is extracted on your machine.</span>
      </label>
      {note?.error && <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 6 }}>{note.error}</div>}
      {note?.source && <div style={{ fontSize: 12, color: 'var(--accent3)', marginTop: 6 }}>✓ {note.source}</div>}
      {note?.warnings?.map((w, i) => <div key={i} style={{ fontSize: 12, color: '#a06000', marginTop: 4 }}>⚠ {w}</div>)}
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
