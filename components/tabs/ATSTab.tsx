'use client'
import { useState, useEffect } from 'react'
import type { ResumeEntry, RegionConfig, RoleConfig } from '@/lib/storage'
import { FitBreakdown } from '@/components/FitBreakdown'
import { labelStyle, inputStyle, selectStyle, primaryBtn, ghostBtn, card, sectionLabel, Field, KeywordBox } from '@/components/ui'

// ── ATS Analyzer ──────────────────────────────────────
export function ATSAnalyzer({ fw, personaId, regions, roles }: { fw: Function; personaId: string; regions: RegionConfig[]; roles: RoleConfig[] }) {
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
      const res = await fw('/api/analyze', { method: 'POST', body: JSON.stringify({ mode: 'deep', jobDescription: jd, title: jobTitle || undefined, company: company || undefined, resumeId: selectedResumeId || undefined, regionId: selectedRegionId || undefined, roleId: selectedRoleId || undefined }) })
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
          {(result.rubric || result.postingFlags?.length > 0) && (
            <div style={card}><FitBreakdown rubric={result.rubric} flags={result.postingFlags} /></div>
          )}
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
