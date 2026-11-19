'use client'
import { useState, useEffect, useCallback } from 'react'
import type { Job, Persona, RegionConfig, RoleConfig } from '@/lib/storage'
import { needsTriage } from '@/lib/rubric'
import { PersonaDropdown } from '@/components/PersonaDropdown'
import { Sidebar } from '@/components/Sidebar'
import { AddJobForm } from '@/components/pipeline/AddJobForm'
import { JobCard } from '@/components/pipeline/JobCard'
import { ATSAnalyzer } from '@/components/tabs/ATSTab'
import { CoverLetterGenerator } from '@/components/tabs/CoverLetterTab'
import { DashboardTab } from '@/components/tabs/DashboardTab'
import { LearningTab } from '@/components/tabs/LearningTab'
import { ResumeTab } from '@/components/tabs/ResumeTab'
import { SourcesTab } from '@/components/tabs/SourcesTab'
import { inputStyle, primaryBtn, ghostBtn, card, sectionLabel, EmptyState, ProgressBar } from '@/components/ui'

type Tab = 'tracker' | 'dashboard' | 'analyze' | 'coverletter' | 'resume' | 'learning' | 'sources'

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
  const [dupCount, setDupCount] = useState(0)
  const [profileUpdatedAt, setProfileUpdatedAt] = useState<string | undefined>()

  const fw = useCallback((url: string, init?: RequestInit) => {
    // File uploads (FormData) need the browser to set the multipart Content-Type itself
    const isForm = typeof FormData !== 'undefined' && init?.body instanceof FormData
    const headers = { ...(init?.headers || {}), 'x-persona-id': personaId, ...(isForm ? {} : { 'Content-Type': 'application/json' }) }
    return fetch(url, { ...init, headers })
  }, [personaId])

  const fetchJobs = useCallback(async () => {
    if (!personaId) return
    const [res, dupRes, profRes] = await Promise.all([fw('/api/jobs'), fw('/api/jobs/dedup'), fw('/api/profile')])
    setJobs(await res.json())
    setDupCount((await dupRes.json()).duplicates || 0)
    setProfileUpdatedAt((await profRes.json()).updatedAt)
  }, [personaId, fw])

  const mergeDuplicates = async () => {
    if (!confirm(`Merge ${dupCount} duplicate job(s)? A backup of your jobs is saved first.`)) return
    const res = await fw('/api/jobs/dedup', { method: 'POST' })
    const r = await res.json()
    alert(`Merged ${r.removed} duplicate(s) into ${r.groups} job(s)` + (r.fieldsFixed ? `, cleaned ${r.fieldsFixed} field(s)` : '') + `.\nBackup: ${r.backup}`)
    fetchJobs()
  }

  const addJob = async (data: any) => {
    const res = await fw('/api/jobs', { method: 'POST', body: JSON.stringify(data) })
    if (!res.ok) { alert((await res.json()).error || 'Could not add job'); return }
    setShowAddForm(false); fetchJobs()
  }

  const fetchRegionsRoles = useCallback(async () => {
    if (!personaId) return
    const [rRes, roRes] = await Promise.all([fw('/api/regions'), fw('/api/roles')])
    setRegions(await rRes.json())
    setRoles(await roRes.json())
  }, [personaId, fw])

  // Deep link: /?tab=dashboard opens that tab
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('tab') as Tab | null
    const tabs: Tab[] = ['tracker', 'dashboard', 'analyze', 'coverletter', 'resume', 'learning', 'sources']
    if (t && tabs.includes(t)) setTab(t)
  }, [])

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
    const unscored = jobs.filter(j => needsTriage(j, profileUpdatedAt))
    if (!unscored.length) return
    setAnalyzing(true); setAnalyzeProgress(0); setAnalyzeTotal(unscored.length)
    for (let i = 0; i < unscored.length; i++) {
      const job = unscored[i]
      setAnalyzeProgress(i + 1)
      try {
        // Stage 1: cheap rubric triage; the route saves the score and breakdown on the job
        await fw('/api/analyze', { method: 'POST', body: JSON.stringify({ mode: 'triage', jobId: job.id }) })
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
        // Stage 2: deep analysis on the shortlist; the route saves everything on the job
        await fw('/api/analyze', { method: 'POST', body: JSON.stringify({ mode: 'deep', jobId: job.id }) })
      } catch { /* skip */ }
    }
    setAnalyzingTopK(false); fetchJobs()
  }

  const triageCount = jobs.filter(j => needsTriage(j, profileUpdatedAt)).length

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
                <button onClick={analyzeAll} disabled={analyzing || !triageCount} title="Rubric-score jobs that are unscored, scored the old way, or scored before your preferences changed" style={{ ...ghostBtn, color: 'var(--accent2)', borderColor: 'var(--accent2)', opacity: analyzing || !triageCount ? 0.5 : 1 }}>
                  {analyzing ? `Triaging ${analyzeProgress}/${analyzeTotal}…` : `🎯 Triage All (${triageCount})`}
                </button>
                {dupCount > 0 && (
                  <button onClick={mergeDuplicates} title="Same company and title, or same link" style={{ ...ghostBtn, color: 'var(--danger)', borderColor: 'var(--danger)' }}>
                    Merge {dupCount} duplicate{dupCount === 1 ? '' : 's'}
                  </button>
                )}
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
                onSave={addJob}
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
        {tab === 'resume' && <ResumeTab fw={fw} personaId={personaId} regions={regions} roles={roles} onRegionsRolesChange={fetchRegionsRoles} onProfileChange={setProfileUpdatedAt} />}
        {tab === 'learning' && <LearningTab fw={fw} roles={roles} />}
        {tab === 'sources' && <SourcesTab fw={fw} onJobsAdded={fetchJobs} checklistTemplate={checklistTemplate} onChecklistTemplateUpdate={tpl => { setChecklistTemplate(tpl); fetch('/api/personas', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ checklistTemplate: tpl }) }) }} onRegionsRolesChange={fetchRegionsRoles} />}
      </main>
      </div>
    </div>
  )
}
