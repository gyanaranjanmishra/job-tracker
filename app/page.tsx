'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import type { Job, JobStatus, ScraperConfig, CompanyEntry, ATSAnalysis, Persona, ResumeEntry, RegionConfig, RoleConfig, LearningEntry } from '@/lib/storage'

// ── Status config (light theme) ────────────────────────
const STATUS_CONFIG: Record<JobStatus, { label: string; color: string; bg: string }> = {
  saved:     { label: 'Saved',     color: '#707090', bg: '#f0f0fa' },
  applied:   { label: 'Applied',   color: '#5b53e8', bg: '#eeedff' },
  interview: { label: 'Interview', color: '#b07800', bg: '#fff8e0' },
  offer:     { label: 'Offer',     color: '#0a7a50', bg: '#e6f7f0' },
  rejected:  { label: 'Rejected',  color: '#c83010', bg: '#fff0ec' },
}

type Tab = 'tracker' | 'dashboard' | 'analyze' | 'coverletter' | 'resume' | 'learning' | 'sources'

// ── Shared styles ──────────────────────────────────────
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontFamily: 'DM Mono, monospace',
  letterSpacing: '0.1em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 6,
}
const inputStyle: React.CSSProperties = {
  background: 'var(--surface2)', border: '1px solid var(--border)',
  borderRadius: 8, padding: '10px 14px', color: 'var(--text)',
  fontSize: 14, fontFamily: 'DM Sans, sans-serif', outline: 'none', width: '100%',
}
const selectStyle: React.CSSProperties = { ...inputStyle, cursor: 'pointer' }
const primaryBtn: React.CSSProperties = {
  background: 'var(--accent)', color: '#fff', border: 'none',
  borderRadius: 8, padding: '10px 20px', fontFamily: 'DM Sans, sans-serif',
  fontSize: 13, fontWeight: 500, cursor: 'pointer',
}
const ghostBtn: React.CSSProperties = {
  background: 'transparent', color: 'var(--muted)',
  border: '1px solid var(--border)', borderRadius: 8,
  padding: '8px 16px', fontFamily: 'DM Sans, sans-serif', fontSize: 13, cursor: 'pointer',
}
const dangerBtn: React.CSSProperties = {
  background: 'transparent', color: 'var(--danger)',
  border: '1px solid var(--danger)', borderRadius: 8,
  padding: '6px 14px', fontFamily: 'DM Sans, sans-serif', fontSize: 12, cursor: 'pointer',
}
const card: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20,
}
const sectionLabel: React.CSSProperties = {
  fontSize: 11, color: 'var(--muted)', fontFamily: 'DM Mono, monospace',
  letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: 14,
}

// ── Input helper ──────────────────────────────────────
function Field({ label, value, onChange, placeholder, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} />
    </div>
  )
}
function EmptyState({ message, icon = '📋' }: { message: string; icon?: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)', fontSize: 14 }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>{icon}</div>{message}
    </div>
  )
}
function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
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

// ── Sidebar ───────────────────────────────────────────
function Sidebar({ jobs, regions, roles, personaName, open, onToggle, filterRegionId, filterRoleId, onFilterRegion, onFilterRole }: {
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

// ── Main App ──────────────────────────────────────────
export default function Home() {
  const [tab, setTab] = useState<Tab>('tracker')
  const [jobs, setJobs] = useState<Job[]>([])
  const [personas, setPersonas] = useState<Persona[]>([])
  const [personaId, setPersonaId] = useState('')
  const [checklistTemplate, setChecklistTemplate] = useState<{ id: string; item: string }[]>([])
  const [regions, setRegions] = useState<RegionConfig[]>([])
  const [roles, setRoles] = useState<RoleConfig[]>([])
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeProgress, setAnalyzeProgress] = useState(0)
  const [analyzeTotal, setAnalyzeTotal] = useState(0)
  const [sortBy, setSortBy] = useState<'date' | 'score'>('date')
  const [topK, setTopK] = useState(10)
  const [analyzingTopK, setAnalyzingTopK] = useState(false)
  const [topKProgress, setTopKProgress] = useState(0)
  const [topKTotal, setTopKTotal] = useState(0)
  const [showAddForm, setShowAddForm] = useState(false)
  const [showPersonaDropdown, setShowPersonaDropdown] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [filterRegionId, setFilterRegionId] = useState('')
  const [filterRoleId, setFilterRoleId] = useState('')
  const [demoMode, setDemoMode] = useState(false)

  const fw = useCallback((url: string, init?: RequestInit) => {
    const headers = { ...(init?.headers || {}), 'x-persona-id': personaId, 'Content-Type': 'application/json' }
    return fetch(url, { ...init, headers })
  }, [personaId])

  const fetchJobs = useCallback(async () => {
    if (!personaId) return
    const res = await fw('/api/jobs')
    setJobs(await res.json())
  }, [personaId, fw])

  const fetchRegionsRoles = useCallback(async () => {
    if (!personaId) return
    const [rRes, roRes] = await Promise.all([fw('/api/regions'), fw('/api/roles')])
    setRegions(await rRes.json())
    setRoles(await roRes.json())
  }, [personaId, fw])

  // Bootstrap: load personas, then set active persona from localStorage
  useEffect(() => {
    fetch('/api/personas').then(r => r.json()).then(data => {
      setPersonas(data.personas || [])
      setChecklistTemplate(data.checklistTemplate || [])
      setDemoMode(!!data.demo)
      const stored = localStorage.getItem('activePersonaId')
      const valid = (data.personas || []).find((p: Persona) => p.id === stored)
      setPersonaId(valid ? stored! : data.personas?.[0]?.id || '')
    })
  }, [])

  useEffect(() => {
    if (!personaId) return
    localStorage.setItem('activePersonaId', personaId)
    fetchJobs()
    fetchRegionsRoles()
  }, [personaId, fetchJobs, fetchRegionsRoles])

  const switchPersona = (id: string) => {
    setPersonaId(id)
    setShowPersonaDropdown(false)
    setTab('tracker')
  }

  const addPersona = async (name: string) => {
    const res = await fetch('/api/personas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) })
    const p = await res.json()
    setPersonas(prev => [...prev, p])
    switchPersona(p.id)
  }

  const analyzeAll = async () => {
    const unscored = jobs.filter(j => j.description && !j.fitScore)
    if (!unscored.length) return
    setAnalyzing(true); setAnalyzeProgress(0); setAnalyzeTotal(unscored.length)
    for (let i = 0; i < unscored.length; i++) {
      const job = unscored[i]
      setAnalyzeProgress(i + 1)
      try {
        const res = await fw('/api/analyze', { method: 'POST', body: JSON.stringify({ jobDescription: job.description, jobId: job.id }) })
        const data = await res.json()
        if (!data.error) {
          await fw('/api/jobs', { method: 'PUT', body: JSON.stringify({ id: job.id, fitScore: data.fitScore, keywords: data.matchedKeywords }) })
        }
      } catch { /* skip */ }
    }
    setAnalyzing(false); fetchJobs()
  }

  const analyzeTopK = async () => {
    const candidates = [...jobs].filter(j => j.fitScore !== undefined && j.description)
      .sort((a, b) => (b.fitScore ?? 0) - (a.fitScore ?? 0)).slice(0, topK)
    if (!candidates.length) return
    setAnalyzingTopK(true); setTopKProgress(0); setTopKTotal(candidates.length)
    for (let i = 0; i < candidates.length; i++) {
      const job = candidates[i]
      setTopKProgress(i + 1)
      try {
        const res = await fw('/api/analyze', { method: 'POST', body: JSON.stringify({ jobDescription: job.description, jobId: job.id }) })
        const data = await res.json()
        if (!data.error) {
          const atsAnalysis: ATSAnalysis = { summary: data.summary, matchedKeywords: data.matchedKeywords, missingKeywords: data.missingKeywords, improvedSummary: data.improvedSummary, suggestions: data.suggestions, analyzedAt: new Date().toISOString() }
          await fw('/api/jobs', { method: 'PUT', body: JSON.stringify({ id: job.id, fitScore: data.fitScore, keywords: data.matchedKeywords, atsAnalysis }) })
        }
      } catch { /* skip */ }
    }
    setAnalyzingTopK(false); fetchJobs()
  }

  const stats = {
    total: jobs.length, applied: jobs.filter(j => j.status === 'applied').length,
    interview: jobs.filter(j => j.status === 'interview').length,
    offer: jobs.filter(j => j.status === 'offer').length,
    scored: jobs.filter(j => j.fitScore !== undefined).length,
  }

  const sortedJobs = [...jobs]
    .filter(j => (!filterRegionId || j.regionId === filterRegionId) && (!filterRoleId || j.roleId === filterRoleId))
    .sort((a, b) =>
      sortBy === 'score' ? (b.fitScore ?? -1) - (a.fitScore ?? -1)
        : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )

  const currentPersona = personas.find(p => p.id === personaId)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Nav */}
      <nav style={{
        borderBottom: '1px solid var(--border)', padding: '0 32px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60,
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(244,244,249,0.95)', backdropFilter: 'blur(12px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, fontFamily: 'Syne, sans-serif', color: '#fff' }}>J</div>
          <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>JobTracker</span>
        </div>

        <div style={{ display: 'flex', gap: 2 }}>
          {([
            ['tracker', '📋 Pipeline'], ['dashboard', '📊 Dashboard'],
            ['analyze', '🎯 ATS'], ['coverletter', '✉️ Cover Letter'],
            ['resume', '📄 Resume'], ['learning', '🎓 Learning'], ['sources', '⚙️ Sources'],
          ] as [Tab, string][]).map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontFamily: 'DM Sans, sans-serif', fontSize: 12, fontWeight: tab === t ? 500 : 400,
              background: tab === t ? 'var(--accent)' : 'transparent',
              color: tab === t ? '#fff' : 'var(--muted)', transition: 'all 0.15s',
            }}>{label}</button>
          ))}
        </div>

        {/* Persona switcher */}
        <div style={{ position: 'relative' }}>
          <button onClick={() => setShowPersonaDropdown(v => !v)} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '6px 14px', cursor: 'pointer',
            fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: 'var(--text)',
          }}>
            <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--accent)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700 }}>
              {currentPersona?.name[0]?.toUpperCase() || '?'}
            </span>
            {currentPersona?.name || 'Loading...'}
            <span style={{ fontSize: 10, color: 'var(--muted)' }}>▾</span>
          </button>
          {showPersonaDropdown && (
            <PersonaDropdown personas={personas} currentId={personaId} onSwitch={switchPersona} onAdd={addPersona} onClose={() => setShowPersonaDropdown(false)} />
          )}
        </div>
      </nav>

      {demoMode && (
        <div style={{
          background: '#fff7e0', borderBottom: '1px solid #f0d58a', color: '#7a5a00',
          padding: '8px 32px', fontSize: 12, fontFamily: 'DM Sans, sans-serif', textAlign: 'center',
        }}>
          <strong>Demo mode:</strong> sample data, and ATS scores and cover letters come from a local keyword matcher instead of Claude.
          Set <code>ANTHROPIC_API_KEY</code> in <code>.env.local</code> to use the real AI features.
        </div>
      )}

      <div style={{ display: 'flex', maxWidth: 1360, margin: '0 auto' }}>
        <Sidebar
          jobs={jobs} regions={regions} roles={roles}
          personaName={currentPersona?.name || ''}
          open={sidebarOpen} onToggle={() => setSidebarOpen(v => !v)}
          filterRegionId={filterRegionId} filterRoleId={filterRoleId}
          onFilterRegion={setFilterRegionId} onFilterRole={setFilterRoleId}
        />
      <main style={{ flex: 1, minWidth: 0, padding: '32px 24px' }}>
        {/* Stats bar */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 28 }}>
          {[
            { label: 'Saved', value: stats.total, color: 'var(--muted)', note: 'Total tracked' },
            { label: 'Scored', value: stats.scored, color: 'var(--accent)', note: 'ATS analyzed' },
            { label: 'Applied', value: stats.applied, color: '#7c6fe8', note: 'Submitted elsewhere' },
            { label: 'Interviews', value: stats.interview, color: 'var(--accent2)', note: 'In pipeline' },
            { label: 'Offers', value: stats.offer, color: 'var(--accent3)', note: 'Received' },
          ].map(s => (
            <div key={s.label} style={card} title={s.note}>
              <div style={{ fontSize: 26, fontFamily: 'Syne, sans-serif', fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'DM Mono, monospace', letterSpacing: '0.08em', marginTop: 2 }}>{s.label.toUpperCase()}</div>
              <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>{s.note}</div>
            </div>
          ))}
        </div>
        <div style={{ marginBottom: 8, fontSize: 11, color: 'var(--muted)', fontFamily: 'DM Mono, monospace', letterSpacing: '0.06em' }}>
          TIP: Update status manually after you apply via external portals — use this as your tracking dashboard, not an application tool.
        </div>

        {/* Tracker tab */}
        {tab === 'tracker' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 20, color: 'var(--text)' }}>Job Pipeline</h2>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ display: 'flex', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                  {(['date', 'score'] as const).map(s => (
                    <button key={s} onClick={() => setSortBy(s)} style={{
                      padding: '6px 14px', border: 'none', cursor: 'pointer',
                      fontFamily: 'DM Mono, monospace', fontSize: 11, letterSpacing: '0.06em',
                      background: sortBy === s ? 'var(--accent)' : 'transparent',
                      color: sortBy === s ? '#fff' : 'var(--muted)',
                    }}>{s === 'date' ? 'DATE' : 'SCORE'}</button>
                  ))}
                </div>
                <button onClick={analyzeAll} disabled={analyzing || !jobs.filter(j => j.description && !j.fitScore).length} style={{ ...ghostBtn, color: 'var(--accent2)', borderColor: 'var(--accent2)', opacity: analyzing || !jobs.filter(j => j.description && !j.fitScore).length ? 0.5 : 1 }}>
                  {analyzing ? `Analyzing ${analyzeProgress}/${analyzeTotal}…` : `🎯 Analyze All (${jobs.filter(j => j.description && !j.fitScore).length})`}
                </button>
                <button onClick={() => setShowAddForm(true)} style={primaryBtn}>+ Add Job</button>
              </div>
            </div>

            {analyzing && <ProgressBar label="SCORING JOBS" progress={analyzeProgress} total={analyzeTotal} color="var(--accent)" />}

            <div style={{ ...card, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div style={sectionLabel}>DEEP ANALYSIS — TOP</div>
              <input type="number" min={1} max={50} value={topK} onChange={e => setTopK(Math.max(1, Math.min(50, Number(e.target.value))))} style={{ ...inputStyle, width: 64, textAlign: 'center', padding: '6px 10px' }} />
              <div style={sectionLabel}>JOBS BY SCORE</div>
              <button onClick={analyzeTopK} disabled={analyzingTopK || !jobs.filter(j => j.fitScore !== undefined && j.description).length} style={{ ...ghostBtn, color: '#7c6fe8', borderColor: '#7c6fe8', opacity: analyzingTopK || !jobs.filter(j => j.fitScore !== undefined && j.description).length ? 0.5 : 1, whiteSpace: 'nowrap' }}>
                {analyzingTopK ? `Analyzing ${topKProgress}/${topKTotal}…` : '✦ Run Full Analysis'}
              </button>
              {analyzingTopK && <div style={{ flex: 1, minWidth: 120 }}><ProgressBar label="" progress={topKProgress} total={topKTotal} color="#7c6fe8" /></div>}
              {!analyzingTopK && <span style={{ ...sectionLabel, margin: 0 }}>{jobs.filter(j => j.atsAnalysis).length} fully analyzed</span>}
            </div>

            {showAddForm && (
              <AddJobForm regions={regions} roles={roles}
                onSave={async data => { await fw('/api/jobs', { method: 'POST', body: JSON.stringify(data) }); setShowAddForm(false); fetchJobs() }}
                onCancel={() => setShowAddForm(false)} />
            )}

            {jobs.length === 0 ? <EmptyState message="No jobs yet. Add your first application above." /> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {sortedJobs.map(job => (
                  <JobCard key={job.id} job={job}
                    personaId={personaId} fw={fw}
                    regions={regions} roles={roles}
                    onStatusChange={async (id, status) => { await fw('/api/jobs', { method: 'PUT', body: JSON.stringify({ id, status }) }); fetchJobs() }}
                    onDelete={async id => { await fw(`/api/jobs?id=${id}`, { method: 'DELETE' }); fetchJobs() }}
                    onDescriptionUpdate={(id, description) => setJobs(prev => prev.map(j => j.id === id ? { ...j, description } : j))}
                    onChecklistUpdate={(id, checklist) => { setJobs(prev => prev.map(j => j.id === id ? { ...j, checklist } : j)); fw('/api/jobs', { method: 'PUT', body: JSON.stringify({ id, checklist }) }) }}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'dashboard' && <DashboardTab jobs={jobs} regions={regions} roles={roles} />}
        {tab === 'analyze' && <ATSAnalyzer fw={fw} personaId={personaId} regions={regions} roles={roles} />}
        {tab === 'coverletter' && <CoverLetterGenerator fw={fw} jobs={jobs} personaId={personaId} regions={regions} roles={roles} />}
        {tab === 'resume' && <ResumeTab fw={fw} personaId={personaId} regions={regions} roles={roles} onRegionsRolesChange={fetchRegionsRoles} />}
        {tab === 'learning' && <LearningTab fw={fw} roles={roles} />}
        {tab === 'sources' && <SourcesTab fw={fw} onJobsAdded={fetchJobs} checklistTemplate={checklistTemplate} onChecklistTemplateUpdate={tpl => { setChecklistTemplate(tpl); fetch('/api/personas', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ checklistTemplate: tpl }) }) }} onRegionsRolesChange={fetchRegionsRoles} />}
      </main>
      </div>
    </div>
  )
}

// ── Persona Dropdown ──────────────────────────────────
function PersonaDropdown({ personas, currentId, onSwitch, onAdd, onClose }: { personas: Persona[]; currentId: string; onSwitch: (id: string) => void; onAdd: (name: string) => void; onClose: () => void }) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <div ref={ref} style={{ position: 'absolute', top: '110%', right: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 8, minWidth: 200, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', zIndex: 100 }}>
      <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'DM Mono, monospace', letterSpacing: '0.1em', padding: '4px 8px 8px', borderBottom: '1px solid var(--border)', marginBottom: 6 }}>SWITCH PROFILE</div>
      {personas.map(p => (
        <button key={p.id} onClick={() => onSwitch(p.id)} style={{
          display: 'flex', alignItems: 'center', gap: 10, width: '100%', background: p.id === currentId ? 'var(--surface2)' : 'transparent',
          border: 'none', borderRadius: 6, padding: '8px 10px', cursor: 'pointer', color: 'var(--text)', fontSize: 13, fontFamily: 'DM Sans, sans-serif',
        }}>
          <span style={{ width: 22, height: 22, borderRadius: '50%', background: p.id === currentId ? 'var(--accent)' : 'var(--border)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: p.id === currentId ? '#fff' : 'var(--muted)', fontSize: 11, fontWeight: 700 }}>{p.name[0]?.toUpperCase()}</span>
          {p.name}
          {p.id === currentId && <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--accent)' }}>✓</span>}
        </button>
      ))}
      <div style={{ borderTop: '1px solid var(--border)', marginTop: 6, paddingTop: 6 }}>
        {adding ? (
          <div style={{ padding: '4px 8px' }}>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Profile name" autoFocus style={{ ...inputStyle, fontSize: 13, padding: '7px 10px', marginBottom: 8 }} onKeyDown={e => { if (e.key === 'Enter' && name.trim()) { onAdd(name.trim()); setAdding(false); setName('') } }} />
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => { if (name.trim()) { onAdd(name.trim()); setAdding(false); setName('') } }} style={{ ...primaryBtn, flex: 1, padding: '7px 0', fontSize: 12 }}>Create</button>
              <button onClick={() => { setAdding(false); setName('') }} style={{ ...ghostBtn, padding: '7px 12px', fontSize: 12 }}>Cancel</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: 'transparent', border: 'none', borderRadius: 6, padding: '8px 10px', cursor: 'pointer', color: 'var(--accent)', fontSize: 13, fontFamily: 'DM Sans, sans-serif' }}>+ Add Profile</button>
        )}
      </div>
    </div>
  )
}

// ── Progress Bar ──────────────────────────────────────
function ProgressBar({ label, progress, total, color }: { label: string; progress: number; total: number; color: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      {label && <div style={{ display: 'flex', justifyContent: 'space-between', ...sectionLabel, marginBottom: 6 }}><span>{label}</span><span>{progress}/{total}</span></div>}
      <div style={{ background: 'var(--border)', borderRadius: 99, height: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 99, background: color, width: `${total > 0 ? (progress / total) * 100 : 0}%`, transition: 'width 0.3s ease' }} />
      </div>
    </div>
  )
}

// ── Add Job Form ──────────────────────────────────────
function AddJobForm({ onSave, onCancel, regions, roles }: { onSave: (d: any) => void; onCancel: () => void; regions: RegionConfig[]; roles: RoleConfig[] }) {
  const [form, setForm] = useState({ title: '', company: '', location: '', url: '', description: '', status: 'saved' as JobStatus, regionId: '', roleId: '' })
  const f = (k: keyof typeof form) => (v: string) => setForm(p => ({ ...p, [k]: v }))

  return (
    <div style={{ ...card, border: '1px solid var(--accent)', marginBottom: 20 }}>
      <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, marginBottom: 16, fontSize: 16, color: 'var(--text)' }}>Add New Job</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Job Title *" value={form.title} onChange={f('title')} placeholder="Senior Developer" />
        <Field label="Company *" value={form.company} onChange={f('company')} placeholder="Acme Corp" />
        <Field label="Location" value={form.location} onChange={f('location')} placeholder="Toronto, ON / Remote" />
        <Field label="Job URL" value={form.url} onChange={f('url')} placeholder="https://..." />
        <div>
          <label style={labelStyle}>Region</label>
          <select value={form.regionId} onChange={e => f('regionId')(e.target.value)} style={selectStyle}>
            <option value="">— No region —</option>
            {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Role</label>
          <select value={form.roleId} onChange={e => f('roleId')(e.target.value)} style={selectStyle}>
            <option value="">— No role —</option>
            {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
      </div>
      <div style={{ marginTop: 12 }}>
        <label style={labelStyle}>Status</label>
        <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as JobStatus }))} style={selectStyle}>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>
      <div style={{ marginTop: 12 }}>
        <label style={labelStyle}>Job Description (paste for ATS analysis)</label>
        <textarea value={form.description} onChange={e => f('description')(e.target.value)} rows={4} placeholder="Paste the full job description here..." style={{ ...inputStyle, resize: 'vertical' }} />
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
        <button onClick={() => { if (form.title && form.company) onSave(form) }} style={primaryBtn}>Save Job</button>
        <button onClick={onCancel} style={ghostBtn}>Cancel</button>
      </div>
    </div>
  )
}

// ── Job Card ──────────────────────────────────────────
function JobCard({ job, onStatusChange, onDelete, onDescriptionUpdate, onChecklistUpdate, personaId, fw, regions, roles }: {
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

// ── Location badge helper ─────────────────────────────
function locationBadgeStyle(loc: string): React.CSSProperties {
  if (/canada|ontario|toronto|vancouver|montreal|calgary|ottawa|bc\b|alberta/i.test(loc))
    return { color: '#b03020', background: '#fdf0ef', border: '1px solid #b0302033' }
  if (/india|bengaluru|bangalore|mumbai|delhi|hyderabad|chennai|pune|noida|gurugram/i.test(loc))
    return { color: '#b06000', background: '#fef5e7', border: '1px solid #b0600033' }
  if (/remote|anywhere|worldwide|global|distributed/i.test(loc))
    return { color: '#1060a0', background: '#eaf4fb', border: '1px solid #1060a033' }
  return { color: 'var(--muted)', background: 'var(--surface2)', border: '1px solid var(--border)' }
}

// ── Job description formatter ─────────────────────────
function FormatDescription({ text }: { text: string }) {
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

// ── Score Badge ───────────────────────────────────────
function ScoreBadge({ score }: { score: number }) {
  const high = score >= 70, mid = score >= 45
  const color = high ? 'var(--accent3)' : mid ? 'var(--accent2)' : 'var(--danger)'
  const bg = high ? '#e6f7f0' : mid ? '#fff8e0' : '#fff0ec'
  const border = high ? '#0a7a5044' : mid ? '#b0780044' : '#c8301044'
  return (
    <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 15, minWidth: 44, textAlign: 'center', padding: '4px 10px', borderRadius: 8, color, background: bg, border: `1px solid ${border}` }} title="Resume fit score">{score}</div>
  )
}

// ── Dashboard Tab ─────────────────────────────────────
function DashboardTab({ jobs, regions, roles }: { jobs: Job[]; regions: RegionConfig[]; roles: RoleConfig[] }) {
  const byRegion = regions.map(r => ({
    region: r,
    jobs: jobs.filter(j => j.regionId === r.id),
  })).filter(x => x.jobs.length > 0)

  const byRole = roles.map(r => ({
    role: r,
    jobs: jobs.filter(j => j.roleId === r.id),
  })).filter(x => x.jobs.length > 0)

  const unassigned = jobs.filter(j => !j.regionId && !j.roleId)
  const recentJobs = [...jobs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 20, color: 'var(--text)', margin: 0 }}>Dashboard</h2>

      {/* Region breakdown */}
      {byRegion.length > 0 && (
        <div style={card}>
          <div style={sectionLabel}>JOBS BY REGION</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            {byRegion.map(({ region, jobs: rJobs }) => (
              <div key={region.id} style={{ background: 'var(--surface2)', borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 15, color: 'var(--text)', marginBottom: 8 }}>{region.name}</div>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => {
                  const count = rJobs.filter(j => j.status === k).length
                  return count > 0 ? (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                      <span style={{ color: 'var(--muted)' }}>{v.label}</span>
                      <span style={{ fontFamily: 'DM Mono, monospace', color: v.color, fontWeight: 500 }}>{count}</span>
                    </div>
                  ) : null
                })}
                <div style={{ borderTop: '1px solid var(--border)', marginTop: 8, paddingTop: 8, fontSize: 12, color: 'var(--muted)', fontFamily: 'DM Mono, monospace', display: 'flex', justifyContent: 'space-between' }}>
                  <span>TOTAL</span><span style={{ color: 'var(--text)', fontWeight: 500 }}>{rJobs.length}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Role breakdown */}
      {byRole.length > 0 && (
        <div style={card}>
          <div style={sectionLabel}>JOBS BY ROLE</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            {byRole.map(({ role, jobs: rJobs }) => (
              <div key={role.id} style={{ background: 'var(--surface2)', borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 15, color: 'var(--text)', marginBottom: 8 }}>{role.name}</div>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => {
                  const count = rJobs.filter(j => j.status === k).length
                  return count > 0 ? (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                      <span style={{ color: 'var(--muted)' }}>{v.label}</span>
                      <span style={{ fontFamily: 'DM Mono, monospace', color: v.color, fontWeight: 500 }}>{count}</span>
                    </div>
                  ) : null
                })}
                <div style={{ borderTop: '1px solid var(--border)', marginTop: 8, paddingTop: 8, fontSize: 12, color: 'var(--muted)', fontFamily: 'DM Mono, monospace', display: 'flex', justifyContent: 'space-between' }}>
                  <span>TOTAL</span><span style={{ color: 'var(--text)', fontWeight: 500 }}>{rJobs.length}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent activity */}
      {recentJobs.length > 0 && (
        <div style={card}>
          <div style={sectionLabel}>RECENT ACTIVITY</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recentJobs.map(job => {
              const cfg = STATUS_CONFIG[job.status]
              return (
                <div key={job.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 500, fontSize: 14, color: 'var(--text)' }}>{job.title}</span>
                    <span style={{ color: 'var(--muted)', fontSize: 13, marginLeft: 8 }}>{job.company}</span>
                  </div>
                  <span style={{ fontSize: 11, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}44`, borderRadius: 6, padding: '2px 8px', fontFamily: 'DM Mono, monospace' }}>{cfg.label}</span>
                  <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>{new Date(job.createdAt).toLocaleDateString()}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {jobs.length === 0 && <EmptyState message="No jobs yet. Add jobs in the Pipeline tab." icon="📊" />}
    </div>
  )
}

// ── ATS Analyzer ──────────────────────────────────────
function ATSAnalyzer({ fw, personaId, regions, roles }: { fw: Function; personaId: string; regions: RegionConfig[]; roles: RoleConfig[] }) {
  const [jd, setJd] = useState('')
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [company, setCompany] = useState('')
  const [resumes, setResumes] = useState<ResumeEntry[]>([])
  const [selectedResumeId, setSelectedResumeId] = useState('')
  const [selectedRegionId, setSelectedRegionId] = useState('')
  const [selectedRoleId, setSelectedRoleId] = useState('')

  useEffect(() => {
    fw('/api/resumes').then((r: Response) => r.json()).then((data: ResumeEntry[]) => {
      setResumes(data)
      if (data.length > 0) setSelectedResumeId(data[0].id)
    })
  }, [personaId])

  const analyze = async () => {
    if (!jd.trim()) return
    setLoading(true); setError(''); setResult(null)
    try {
      const res = await fw('/api/analyze', { method: 'POST', body: JSON.stringify({ jobDescription: jd, resumeId: selectedResumeId || undefined, regionId: selectedRegionId || undefined, roleId: selectedRoleId || undefined }) })
      const data = await res.json()
      if (data.error) setError(data.error)
      else setResult(data)
    } catch { setError('Analysis failed. Check your API key.') }
    setLoading(false)
  }

  const exportToFile = () => {
    if (!result) return
    const date = new Date().toLocaleDateString('en-CA')
    const blob = new Blob([`ATS ANALYSIS\nRole: ${jobTitle}\nCompany: ${company}\nScore: ${result.fitScore}/100\n\n${result.summary}\n\nMISSING: ${result.missingKeywords?.join(', ')}\n\nMATCHED: ${result.matchedKeywords?.join(', ')}\n\n${result.improvedSummary}`], { type: 'text/plain' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `ats-${company || 'job'}-${date}.txt`; a.click()
  }

  // Auto-select resume based on region/role
  const handleRoleChange = (roleId: string) => {
    setSelectedRoleId(roleId)
    const role = roles.find(r => r.id === roleId)
    if (role?.resumeId) setSelectedResumeId(role.resumeId)
    else if (role?.regionId) {
      const best = resumes.find(r => r.regionId === role.regionId)
      if (best) setSelectedResumeId(best.id)
    }
  }

  const handleRegionChange = (regionId: string) => {
    setSelectedRegionId(regionId)
    if (!selectedRoleId) {
      const best = resumes.find(r => r.regionId === regionId)
      if (best) setSelectedResumeId(best.id)
    }
  }

  return (
    <div>
      <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 20, marginBottom: 8, color: 'var(--text)' }}>ATS Resume Analyzer</h2>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 20 }}>Compare a job description against your resume. Claude will score fit, find gaps, and rewrite sections.</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <Field label="Job Title (for export)" value={jobTitle} onChange={setJobTitle} placeholder="Data Analyst" />
        <Field label="Company (for export)" value={company} onChange={setCompany} placeholder="Acme Corp" />
        <div>
          <label style={labelStyle}>Region</label>
          <select value={selectedRegionId} onChange={e => handleRegionChange(e.target.value)} style={selectStyle}>
            <option value="">— Any region —</option>
            {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Role</label>
          <select value={selectedRoleId} onChange={e => handleRoleChange(e.target.value)} style={selectStyle}>
            <option value="">— Any role —</option>
            {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Resume to use {selectedResumeId ? '(auto-selected)' : ''}</label>
        <select value={selectedResumeId} onChange={e => setSelectedResumeId(e.target.value)} style={selectStyle}>
          <option value="">— Auto (best match) —</option>
          {resumes.map(r => <option key={r.id} value={r.id}>{r.name}{r.regionId ? ` [${regions.find(rg => rg.id === r.regionId)?.name || 'region'}]` : ''}{r.roleId ? ` · ${roles.find(ro => ro.id === r.roleId)?.name || 'role'}` : ''}</option>)}
        </select>
      </div>

      <label style={labelStyle}>Job Description</label>
      <textarea value={jd} onChange={e => setJd(e.target.value)} rows={8} placeholder="Paste the full job description here..." style={{ ...inputStyle, resize: 'vertical', marginBottom: 12 }} />

      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button onClick={analyze} disabled={loading || !jd.trim()} style={{ ...primaryBtn, opacity: loading || !jd.trim() ? 0.5 : 1 }}>{loading ? 'Analyzing…' : '🎯 Analyze Resume Fit'}</button>
        {result && <button onClick={exportToFile} style={{ ...ghostBtn, borderColor: 'var(--accent3)', color: 'var(--accent3)' }}>↓ Export .txt</button>}
      </div>

      {error && <div style={{ marginTop: 16, color: 'var(--danger)', fontSize: 14 }}>{error}</div>}

      {result && (
        <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16 }}>
            <div style={{ ...card, textAlign: 'center' }}>
              <div style={{ fontSize: 52, fontFamily: 'Syne, sans-serif', fontWeight: 800, color: result.fitScore >= 70 ? 'var(--accent3)' : result.fitScore >= 45 ? 'var(--accent2)' : 'var(--danger)' }}>{result.fitScore}</div>
              <div style={{ color: 'var(--muted)', fontSize: 11, fontFamily: 'DM Mono, monospace', letterSpacing: '0.1em' }}>FIT SCORE / 100</div>
            </div>
            <div style={card}>
              <div style={sectionLabel}>ASSESSMENT</div>
              <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text)' }}>{result.summary}</p>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <KeywordBox title="✓ Matched" keywords={result.matchedKeywords} color="var(--accent3)" bg="#e6f7f0" />
            <KeywordBox title="✕ Missing" keywords={result.missingKeywords} color="var(--danger)" bg="#fff0ec" />
          </div>
          {result.improvedSummary && (
            <div style={{ ...card, border: '1px solid var(--accent)' }}>
              <div style={{ ...sectionLabel, color: 'var(--accent)' }}>✦ REWRITTEN PROFESSIONAL SUMMARY</div>
              <p style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--text)' }}>{result.improvedSummary}</p>
              <button onClick={() => navigator.clipboard.writeText(result.improvedSummary)} style={{ ...ghostBtn, marginTop: 12, fontSize: 12 }}>Copy</button>
            </div>
          )}
          {result.suggestions?.length > 0 && (
            <div>
              <div style={sectionLabel}>SECTION IMPROVEMENTS</div>
              {result.suggestions.map((s: any, i: number) => (
                <div key={i} style={{ ...card, marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: 'var(--accent2)', fontFamily: 'DM Mono, monospace', marginBottom: 8 }}>{s.section?.toUpperCase()}</div>
                  {s.original && <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8, fontStyle: 'italic' }}>Before: {s.original}</p>}
                  <p style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.7 }}>{s.improved}</p>
                  <button onClick={() => navigator.clipboard.writeText(s.improved)} style={{ ...ghostBtn, marginTop: 10, fontSize: 12 }}>Copy</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function KeywordBox({ title, keywords, color, bg }: { title: string; keywords: string[]; color: string; bg: string }) {
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

// ── Cover Letter ──────────────────────────────────────
function CoverLetterGenerator({ fw, jobs, personaId, regions, roles }: { fw: Function; jobs: Job[]; personaId: string; regions: RegionConfig[]; roles: RoleConfig[] }) {
  const [jobTitle, setJobTitle] = useState('')
  const [company, setCompany] = useState('')
  const [jd, setJd] = useState('')
  const [tone, setTone] = useState('professional but personable')
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedJobId, setSelectedJobId] = useState('')
  const [resumes, setResumes] = useState<ResumeEntry[]>([])
  const [selectedResumeId, setSelectedResumeId] = useState('')
  const [selectedRoleId, setSelectedRoleId] = useState('')

  useEffect(() => {
    fw('/api/resumes').then((r: Response) => r.json()).then((data: ResumeEntry[]) => {
      setResumes(data)
      if (data.length > 0) setSelectedResumeId(data[0].id)
    })
  }, [personaId])

  const fillFromJob = (id: string) => {
    const job = jobs.find(j => j.id === id)
    if (job) { setJobTitle(job.title); setCompany(job.company); setJd(job.description); setSelectedJobId(id) }
  }

  const handleRoleChange = (roleId: string) => {
    setSelectedRoleId(roleId)
    const role = roles.find(r => r.id === roleId)
    if (role?.resumeId) setSelectedResumeId(role.resumeId)
  }

  const generate = async () => {
    setLoading(true); setError(''); setResult('')
    try {
      const res = await fw('/api/coverletter', { method: 'POST', body: JSON.stringify({ jobTitle, company, jobDescription: jd, tone, resumeId: selectedResumeId || undefined, roleId: selectedRoleId || undefined }) })
      const data = await res.json()
      if (data.error) setError(data.error)
      else setResult(data.coverLetter)
    } catch { setError('Generation failed.') }
    setLoading(false)
  }

  return (
    <div>
      <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 20, marginBottom: 8, color: 'var(--text)' }}>Cover Letter Generator</h2>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 20 }}>Generate a tailored cover letter from your resume and the job description.</p>

      {jobs.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Quick Fill from Tracked Job</label>
          <select value={selectedJobId} onChange={e => fillFromJob(e.target.value)} style={selectStyle}>
            <option value="">— Select a job —</option>
            {jobs.map(j => <option key={j.id} value={j.id}>{j.title} @ {j.company}</option>)}
          </select>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <Field label="Job Title" value={jobTitle} onChange={setJobTitle} placeholder="Product Manager" />
        <Field label="Company" value={company} onChange={setCompany} placeholder="Stripe" />
        <div>
          <label style={labelStyle}>Role (auto-selects resume)</label>
          <select value={selectedRoleId} onChange={e => handleRoleChange(e.target.value)} style={selectStyle}>
            <option value="">— Select role —</option>
            {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Resume</label>
          <select value={selectedResumeId} onChange={e => setSelectedResumeId(e.target.value)} style={selectStyle}>
            {resumes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Tone</label>
        <select value={tone} onChange={e => setTone(e.target.value)} style={selectStyle}>
          <option>professional but personable</option>
          <option>confident and direct</option>
          <option>enthusiastic and energetic</option>
          <option>formal and traditional</option>
        </select>
      </div>

      <label style={labelStyle}>Job Description</label>
      <textarea value={jd} onChange={e => setJd(e.target.value)} rows={6} placeholder="Paste job description..." style={{ ...inputStyle, resize: 'vertical', marginBottom: 12 }} />

      <button onClick={generate} disabled={loading || !jobTitle || !company} style={{ ...primaryBtn, opacity: loading || !jobTitle || !company ? 0.5 : 1 }}>{loading ? 'Writing…' : '✉️ Generate Cover Letter'}</button>
      {error && <div style={{ marginTop: 16, color: 'var(--danger)', fontSize: 14 }}>{error}</div>}

      {result && (
        <div style={{ marginTop: 24, ...card, border: '1px solid var(--accent)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ ...sectionLabel, color: 'var(--accent)', margin: 0 }}>✦ GENERATED COVER LETTER</div>
            <button onClick={() => navigator.clipboard.writeText(result)} style={{ ...ghostBtn, fontSize: 12 }}>Copy All</button>
          </div>
          <p style={{ fontSize: 14, lineHeight: 1.9, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>{result}</p>
        </div>
      )}
    </div>
  )
}

// ── Resume Tab ────────────────────────────────────────
function ResumeTab({ fw, personaId, regions, roles, onRegionsRolesChange }: { fw: Function; personaId: string; regions: RegionConfig[]; roles: RoleConfig[]; onRegionsRolesChange: () => void }) {
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
    </div>
  )
}

// ── Learning Tab ──────────────────────────────────────
function LearningTab({ fw, roles }: { fw: Function; roles: RoleConfig[] }) {
  const [selectedRole, setSelectedRole] = useState('')
  const [data, setData] = useState<{ role: string; skills: any[] } | null>(null)
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
              <div style={{ ...sectionLabel, color: 'var(--danger)' }}>🎯 SKILLS TO DEVELOP — {missing.length} gaps found across {data.skills.reduce((a: number, b: any) => a + b.jobIds.length, 0)} job descriptions</div>
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

// ── Sources Tab ───────────────────────────────────────
function SourcesTab({ fw, onJobsAdded, checklistTemplate, onChecklistTemplateUpdate, onRegionsRolesChange }: {
  fw: Function; onJobsAdded: () => void
  checklistTemplate: { id: string; item: string }[]
  onChecklistTemplateUpdate: (tpl: { id: string; item: string }[]) => void
  onRegionsRolesChange: () => void
}) {
  const [config, setConfig] = useState<ScraperConfig>({ keywords: [], sources: { remotive: true, arbeitnow: true, themuse: false, adzuna: true }, companies: [], interval: 'daily', enabled: true, lastRun: '' })
  const [keywordsText, setKeywordsText] = useState('')
  const [loading, setLoading] = useState(true)
  const [scraping, setScraping] = useState(false)
  const [saved, setSaved] = useState(false)
  const [scrapeResult, setScrapeResult] = useState<{ added: number; sources?: { source: string; fetched: number; error?: string }[] } | null>(null)
  const [scrapeError, setScrapeError] = useState('')
  const [showAddCompany, setShowAddCompany] = useState(false)
  const [companyForm, setCompanyForm] = useState({ name: '', type: 'greenhouse' as CompanyEntry['type'], slug: '' })
  const [regions, setRegions] = useState<RegionConfig[]>([])
  const [roles, setRoles] = useState<RoleConfig[]>([])
  const [resumes, setResumes] = useState<ResumeEntry[]>([])
  const [showAddRegion, setShowAddRegion] = useState(false)
  const [newRegionName, setNewRegionName] = useState('')
  const [showAddRole, setShowAddRole] = useState(false)
  const [newRoleForm, setNewRoleForm] = useState({ name: '', regionId: '', resumeId: '' })
  const [editingRole, setEditingRole] = useState<RoleConfig | null>(null)
  const [newBoardForms, setNewBoardForms] = useState<Record<string, { name: string; url: string }>>({})
  const [newChecklistItem, setNewChecklistItem] = useState('')
  const [tpl, setTpl] = useState(checklistTemplate)

  useEffect(() => { setTpl(checklistTemplate) }, [checklistTemplate])

  useEffect(() => {
    fw('/api/scrape/config').then((r: Response) => r.json()).then((c: ScraperConfig) => { setConfig(c); setKeywordsText(c.keywords.join(', ')); setLoading(false) })
    fw('/api/regions').then((r: Response) => r.json()).then(setRegions)
    fw('/api/roles').then((r: Response) => r.json()).then(setRoles)
    fw('/api/resumes').then((r: Response) => r.json()).then(setResumes)
  }, [])

  const saveConfig = async (updated: ScraperConfig) => {
    await fw('/api/scrape/config', { method: 'POST', body: JSON.stringify(updated) })
    setConfig(updated); setSaved(true); setTimeout(() => setSaved(false), 2000)
  }

  const handleScrapeNow = async () => {
    setScraping(true); setScrapeResult(null); setScrapeError('')
    try {
      const res = await fw('/api/scrape', { method: 'POST' })
      const data = await res.json()
      if (data.error) setScrapeError(data.error)
      else { setScrapeResult(data); onJobsAdded(); fw('/api/scrape/config').then((r: Response) => r.json()).then(setConfig) }
    } catch { setScrapeError('Scrape failed.') }
    setScraping(false)
  }

  const addCompany = () => {
    if (!companyForm.name || !companyForm.slug) return
    const entry: CompanyEntry = { id: crypto.randomUUID(), name: companyForm.name, type: companyForm.type, slug: companyForm.slug, enabled: true }
    const updated = { ...config, companies: [...config.companies, entry] }
    saveConfig(updated); setCompanyForm({ name: '', type: 'greenhouse', slug: '' }); setShowAddCompany(false)
  }

  const addRegion = async () => {
    if (!newRegionName.trim()) return
    const res = await fw('/api/regions', { method: 'POST', body: JSON.stringify({ action: 'add_region', name: newRegionName.trim() }) })
    const region = await res.json()
    setRegions(prev => [...prev, region]); setNewRegionName(''); setShowAddRegion(false); onRegionsRolesChange()
  }

  const deleteRegion = async (regionId: string) => {
    await fw(`/api/regions?regionId=${regionId}`, { method: 'DELETE' })
    setRegions(prev => prev.filter(r => r.id !== regionId)); onRegionsRolesChange()
  }

  const addBoard = async (regionId: string) => {
    const form = newBoardForms[regionId]
    if (!form?.name) return
    await fw('/api/regions', { method: 'POST', body: JSON.stringify({ action: 'add_board', regionId, name: form.name, url: form.url || '' }) })
    setNewBoardForms(prev => ({ ...prev, [regionId]: { name: '', url: '' } }))
    fw('/api/regions').then((r: Response) => r.json()).then(setRegions)
  }

  const toggleBoard = async (boardId: string) => {
    await fw('/api/regions', { method: 'PUT', body: JSON.stringify({ action: 'toggle_board', boardId }) })
    setRegions(prev => prev.map(r => ({ ...r, boards: r.boards.map(b => b.id === boardId ? { ...b, enabled: !b.enabled } : b) })))
  }

  const deleteBoard = async (boardId: string) => {
    await fw(`/api/regions?boardId=${boardId}`, { method: 'DELETE' })
    setRegions(prev => prev.map(r => ({ ...r, boards: r.boards.filter(b => b.id !== boardId) })))
  }

  const addRole = async () => {
    if (!newRoleForm.name.trim()) return
    const res = await fw('/api/roles', { method: 'POST', body: JSON.stringify(newRoleForm) })
    const role = await res.json()
    setRoles(prev => [...prev, role]); setNewRoleForm({ name: '', regionId: '', resumeId: '' }); setShowAddRole(false); onRegionsRolesChange()
  }

  const saveRole = async (role: RoleConfig) => {
    await fw('/api/roles', { method: 'PUT', body: JSON.stringify(role) })
    setRoles(prev => prev.map(r => r.id === role.id ? role : r)); setEditingRole(null); onRegionsRolesChange()
  }

  const deleteRole = async (id: string) => {
    await fw(`/api/roles?id=${id}`, { method: 'DELETE' })
    setRoles(prev => prev.filter(r => r.id !== id)); onRegionsRolesChange()
  }

  const saveTpl = () => { onChecklistTemplateUpdate(tpl) }
  const addChecklistItem = () => {
    if (!newChecklistItem.trim()) return
    setTpl(prev => [...prev, { id: crypto.randomUUID(), item: newChecklistItem.trim() }])
    setNewChecklistItem('')
  }

  if (loading) return <div style={{ color: 'var(--muted)' }}>Loading…</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 20, color: 'var(--text)', marginBottom: 4 }}>Sources & Settings</h2>
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>Configure job scraping, regions, job boards, roles, and application checklists.</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {config.lastRun && <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>Last run: {new Date(config.lastRun).toLocaleString()}</span>}
          <button onClick={handleScrapeNow} disabled={scraping} style={{ ...primaryBtn, opacity: scraping ? 0.6 : 1, minWidth: 120 }}>{scraping ? 'Scraping…' : '▶ Scrape Now'}</button>
        </div>
      </div>

      {scrapeResult && (
        <div style={{ background: '#e6f7f0', border: '1px solid #0a7a5044', borderRadius: 10, padding: '12px 18px' }}>
          <div style={{ fontSize: 13, color: 'var(--accent3)', marginBottom: scrapeResult.sources?.length ? 10 : 0 }}>
            {scrapeResult.added > 0 ? `✓ Added ${scrapeResult.added} new job${scrapeResult.added === 1 ? '' : 's'} to your pipeline.` : '✓ Scrape complete — no new jobs found.'}
          </div>
          {scrapeResult.sources && scrapeResult.sources.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {scrapeResult.sources.map(s => (
                <span key={s.source} style={{ fontSize: 11, fontFamily: 'DM Mono, monospace', padding: '3px 10px', borderRadius: 6, background: s.error ? '#fff0ec' : '#d4f0e4', color: s.error ? 'var(--danger)' : 'var(--accent3)', border: `1px solid ${s.error ? '#c8301033' : '#0a7a5033'}` }}>
                  {s.source}: {s.error ? `✗ ${s.error.slice(0, 40)}` : `✓ ${s.fetched} fetched`}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
      {scrapeError && <div style={{ background: '#fff0ec', border: '1px solid #c8301044', borderRadius: 10, padding: '12px 18px', fontSize: 13, color: 'var(--danger)' }}>{scrapeError}</div>}

      {/* Scraping note */}
      <div style={{ ...card, background: '#f8f7ff', border: '1px solid var(--accent)22' }}>
        <div style={sectionLabel}>MANUAL SCRAPING</div>
        <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>
          Scraping runs on demand only. Click <strong>Scrape Now</strong> above whenever you want fresh results.
          Jobs are filtered to Canada, India, and Remote locations. Duplicates across portals are automatically removed.
        </p>
      </div>

      {/* Keywords */}
      <div style={card}>
        <div style={sectionLabel}>SEARCH KEYWORDS</div>
        <label style={labelStyle}>Roles / skills (comma-separated)</label>
        <input value={keywordsText} onChange={e => setKeywordsText(e.target.value)} placeholder="e.g. data analyst, python, business intelligence" style={inputStyle} />
        <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>Jobs must contain at least one term. Leave empty to pull everything (not recommended).</p>
      </div>

      {/* API job boards */}
      <div style={card}>
        <div style={sectionLabel}>API JOB SOURCES</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {([
            { key: 'adzuna', label: 'Adzuna Canada', desc: 'Toronto-area jobs. Requires ADZUNA_APP_ID + ADZUNA_APP_KEY in .env.local' },
            { key: 'remotive', label: 'Remotive', desc: 'Remote tech jobs globally. Free API.' },
            { key: 'arbeitnow', label: 'Arbeitnow', desc: 'Mostly Europe-focused — disabled by default.' },
            { key: 'themuse', label: 'The Muse', desc: 'US-centric listings — disabled by default.' },
          ] as { key: keyof ScraperConfig['sources']; label: string; desc: string }[]).map(s => (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <Toggle on={config.sources[s.key]} onToggle={() => setConfig(c => ({ ...c, sources: { ...c.sources, [s.key]: !c.sources[s.key] } }))} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: config.sources[s.key] ? 'var(--text)' : 'var(--muted)' }}>{s.label}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Regions & Boards */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={sectionLabel}>REGIONS & JOB BOARDS</div>
          <button onClick={() => setShowAddRegion(v => !v)} style={{ ...ghostBtn, fontSize: 12, padding: '5px 12px' }}>{showAddRegion ? 'Cancel' : '+ Add Region'}</button>
        </div>
        {showAddRegion && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <input value={newRegionName} onChange={e => setNewRegionName(e.target.value)} placeholder="Region name (e.g. USA, UK)" style={{ ...inputStyle, flex: 1 }} onKeyDown={e => e.key === 'Enter' && addRegion()} />
            <button onClick={addRegion} style={primaryBtn}>Add</button>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {regions.map(region => (
            <div key={region.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{region.name}</div>
                <button onClick={() => { if (confirm(`Delete region "${region.name}"?`)) deleteRegion(region.id) }} style={dangerBtn}>Delete Region</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                {region.boards.map(board => (
                  <div key={board.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface2)', borderRadius: 8, padding: '8px 12px', opacity: board.enabled ? 1 : 0.6 }}>
                    <Toggle on={board.enabled} onToggle={() => toggleBoard(board.id)} />
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: 14, color: board.enabled ? 'var(--text)' : 'var(--muted)', fontWeight: 500 }}>{board.name}</span>
                      {board.url && <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'DM Mono, monospace', marginLeft: 8 }}>{board.url}</span>}
                    </div>
                    {board.url && <a href={board.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'none' }}>↗</a>}
                    <button onClick={() => deleteBoard(board.id)} style={{ background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 16, padding: '0 4px' }}>×</button>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={newBoardForms[region.id]?.name || ''} onChange={e => setNewBoardForms(prev => ({ ...prev, [region.id]: { ...prev[region.id], name: e.target.value } }))} placeholder="Board name" style={{ ...inputStyle, flex: 1 }} />
                <input value={newBoardForms[region.id]?.url || ''} onChange={e => setNewBoardForms(prev => ({ ...prev, [region.id]: { ...prev[region.id], url: e.target.value } }))} placeholder="URL (optional)" style={{ ...inputStyle, flex: 2 }} />
                <button onClick={() => addBoard(region.id)} style={ghostBtn}>+ Add Board</button>
              </div>
            </div>
          ))}
          {regions.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 13 }}>No regions yet. Click "+ Add Region" to create one.</p>}
        </div>
      </div>

      {/* Roles */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={sectionLabel}>ROLES</div>
          <button onClick={() => setShowAddRole(v => !v)} style={{ ...ghostBtn, fontSize: 12, padding: '5px 12px' }}>{showAddRole ? 'Cancel' : '+ Add Role'}</button>
        </div>
        {showAddRole && (
          <div style={{ background: 'var(--surface2)', border: '1px solid var(--accent)', borderRadius: 10, padding: 14, marginBottom: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
              <Field label="Role Name *" value={newRoleForm.name} onChange={v => setNewRoleForm(f => ({ ...f, name: v }))} placeholder="Data Analyst" />
              <div>
                <label style={labelStyle}>Default Region</label>
                <select value={newRoleForm.regionId} onChange={e => setNewRoleForm(f => ({ ...f, regionId: e.target.value }))} style={selectStyle}>
                  <option value="">— None —</option>
                  {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Default Resume</label>
                <select value={newRoleForm.resumeId} onChange={e => setNewRoleForm(f => ({ ...f, resumeId: e.target.value }))} style={selectStyle}>
                  <option value="">— Auto —</option>
                  {resumes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={addRole} style={primaryBtn}>Add Role</button>
              <button onClick={() => setShowAddRole(false)} style={ghostBtn}>Cancel</button>
            </div>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {roles.map(role => (
            <div key={role.id} style={{ background: 'var(--surface2)', borderRadius: 8, padding: '10px 14px', border: '1px solid var(--border)' }}>
              {editingRole?.id === role.id ? (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                    <Field label="Name" value={editingRole.name} onChange={v => setEditingRole(r => r ? { ...r, name: v } : r)} placeholder="Role name" />
                    <div>
                      <label style={labelStyle}>Default Region</label>
                      <select value={editingRole.regionId || ''} onChange={e => setEditingRole(r => r ? { ...r, regionId: e.target.value } : r)} style={selectStyle}>
                        <option value="">— None —</option>
                        {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Default Resume</label>
                      <select value={editingRole.resumeId || ''} onChange={e => setEditingRole(r => r ? { ...r, resumeId: e.target.value } : r)} style={selectStyle}>
                        <option value="">— Auto —</option>
                        {resumes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => saveRole(editingRole)} style={primaryBtn}>Save</button>
                    <button onClick={() => setEditingRole(null)} style={ghostBtn}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 500, fontSize: 14, color: 'var(--text)' }}>{role.name}</span>
                    <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 10 }}>
                      {role.regionId ? `Region: ${regions.find(r => r.id === role.regionId)?.name}` : 'No region'}
                      {role.resumeId ? ` · Resume: ${resumes.find(r => r.id === role.resumeId)?.name}` : ' · Auto resume'}
                    </span>
                  </div>
                  <button onClick={() => setEditingRole(role)} style={{ ...ghostBtn, fontSize: 12, padding: '4px 10px' }}>Edit</button>
                  <button onClick={() => { if (confirm('Delete role?')) deleteRole(role.id) }} style={dangerBtn}>Delete</button>
                </div>
              )}
            </div>
          ))}
          {roles.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 13 }}>No roles yet. Add roles to enable resume auto-selection and learning tracking.</p>}
        </div>
      </div>

      {/* Company watchlist */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={sectionLabel}>COMPANY WATCHLIST</div>
          <button onClick={() => setShowAddCompany(v => !v)} style={{ ...ghostBtn, fontSize: 12, padding: '5px 12px' }}>{showAddCompany ? 'Cancel' : '+ Add Company'}</button>
        </div>
        {showAddCompany && (
          <div style={{ background: 'var(--surface2)', border: '1px solid var(--accent)', borderRadius: 10, padding: 14, marginBottom: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
              <Field label="Company Name" value={companyForm.name} onChange={v => setCompanyForm(f => ({ ...f, name: v }))} placeholder="Stripe" />
              <div>
                <label style={labelStyle}>Type</label>
                <select value={companyForm.type} onChange={e => setCompanyForm(f => ({ ...f, type: e.target.value as CompanyEntry['type'] }))} style={selectStyle}>
                  <option value="greenhouse">Greenhouse</option>
                  <option value="lever">Lever</option>
                  <option value="url">Direct URL</option>
                </select>
              </div>
              <Field label={companyForm.type === 'url' ? 'Careers Page URL' : 'Company Slug'} value={companyForm.slug} onChange={v => setCompanyForm(f => ({ ...f, slug: v }))} placeholder={companyForm.type === 'url' ? 'https://stripe.com/jobs' : 'stripe'} />
            </div>
            <button onClick={addCompany} disabled={!companyForm.name || !companyForm.slug} style={{ ...primaryBtn, opacity: !companyForm.name || !companyForm.slug ? 0.5 : 1 }}>Add Company</button>
          </div>
        )}
        {config.companies.length === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>No companies added yet. Watch specific employer career pages.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {config.companies.map(c => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface2)', borderRadius: 8, padding: '10px 14px', opacity: c.enabled ? 1 : 0.6 }}>
                <Toggle on={c.enabled} onToggle={() => saveConfig({ ...config, companies: config.companies.map(x => x.id === c.id ? { ...x, enabled: !x.enabled } : x) })} />
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{c.name}</span>
                  <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'DM Mono, monospace', marginLeft: 10 }}>{c.type} · {c.slug}</span>
                </div>
                <button onClick={() => saveConfig({ ...config, companies: config.companies.filter(x => x.id !== c.id) })} style={{ background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 18, padding: '0 4px' }}>×</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Checklist template */}
      <div style={card}>
        <div style={sectionLabel}>APPLICATION CHECKLIST TEMPLATE</div>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14 }}>These items are added to every new job automatically. Edit freely.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
          {tpl.map((item, i) => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface2)', borderRadius: 8, padding: '8px 12px' }}>
              <span style={{ fontSize: 13, color: 'var(--text)', flex: 1 }}>{item.item}</span>
              <button onClick={() => setTpl(prev => prev.filter((_, idx) => idx !== i))} style={{ background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 16, padding: '0 4px' }}>×</button>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
          <input value={newChecklistItem} onChange={e => setNewChecklistItem(e.target.value)} placeholder="Add a checklist item…" style={{ ...inputStyle, flex: 1 }} onKeyDown={e => e.key === 'Enter' && addChecklistItem()} />
          <button onClick={addChecklistItem} style={ghostBtn}>+ Add</button>
        </div>
        <button onClick={saveTpl} style={primaryBtn}>Save Template</button>
        {saved && <span style={{ fontSize: 13, color: 'var(--accent3)', marginLeft: 12 }}>✓ Saved</span>}
      </div>

      {/* Save scraper config */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => saveConfig({ ...config, keywords: keywordsText.split(',').map(k => k.trim()).filter(Boolean) })} style={primaryBtn}>Save Scraper Config</button>
        {saved && <span style={{ fontSize: 13, color: 'var(--accent3)' }}>✓ Saved</span>}
      </div>
    </div>
  )
}
