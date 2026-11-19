'use client'
import { useState, useEffect } from 'react'
import type { Job, ResumeEntry, RegionConfig, RoleConfig } from '@/lib/storage'
import { PostingFlags } from '@/components/FitBreakdown'
import { labelStyle, inputStyle, selectStyle, primaryBtn, ghostBtn, card, sectionLabel, Field } from '@/components/ui'

// ── Cover Letter ──────────────────────────────────────
export function CoverLetterGenerator({ fw, jobs, personaId, regions, roles }: { fw: Function; jobs: Job[]; personaId: string; regions: RegionConfig[]; roles: RoleConfig[] }) {
  const [jobTitle, setJobTitle] = useState('')
  const [company, setCompany] = useState('')
  const [jd, setJd] = useState('')
  const [tone, setTone] = useState('professional but personable')
  const [result, setResult] = useState('')
  const [review, setReview] = useState<any>(null)
  const [showDraft, setShowDraft] = useState(false)
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
    setLoading(true); setError(''); setResult(''); setReview(null); setShowDraft(false)
    try {
      const res = await fw('/api/coverletter', { method: 'POST', body: JSON.stringify({ jobTitle, company, jobDescription: jd, tone, jobId: selectedJobId || undefined, resumeId: selectedResumeId || undefined, roleId: selectedRoleId || undefined }) })
      const data = await res.json()
      if (data.error) setError(data.error)
      else { setResult(data.coverLetter); setReview(data) }
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

      <button onClick={generate} disabled={loading || !jobTitle || !company} style={{ ...primaryBtn, opacity: loading || !jobTitle || !company ? 0.5 : 1 }}>{loading ? 'Drafting and reviewing…' : '✉️ Generate Cover Letter'}</button>
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

      {result && review && <LetterReview review={review} showDraft={showDraft} setShowDraft={setShowDraft} />}
    </div>
  )
}

export function LetterReview({ review, showDraft, setShowDraft }: { review: any; showDraft: boolean; setShowDraft: (v: boolean) => void }) {
  const issues: any[] = review.issues || []
  const remaining: any[] = review.remainingIssues || []
  const issueRow = (it: any, i: number) => (
    <div key={i} style={{ fontSize: 12, lineHeight: 1.6, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: it.source === 'lint' ? 'var(--accent2)' : 'var(--accent)', marginRight: 8 }}>{(it.source || '').toUpperCase()} · {it.kind}</span>
      {it.quote && <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>“{it.quote}” </span>}
      <span style={{ color: 'var(--text)' }}>→ {it.fix}</span>
    </div>
  )
  return (
    <div style={{ marginTop: 16, ...card, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div style={sectionLabel}>REVIEW PASS</div>
        {review.model && <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>{review.usedResearch ? 'with company research · ' : ''}{review.model}</div>}
      </div>
      <div style={{ fontSize: 13, color: 'var(--text)' }}>
        {review.revised
          ? `A reviewer found ${issues.length} issue${issues.length === 1 ? '' : 's'} in the first draft, and the letter above is the revised version.`
          : issues.length
            ? <span style={{ color: 'var(--danger)' }}>{issues.length} issue{issues.length === 1 ? '' : 's'} flagged and no revision pass ran; check before sending.</span>
            : 'The reviewer passed the first draft with no changes.'}
        {review.revised && remaining.length > 0 && <span style={{ color: 'var(--danger)' }}> {remaining.length} issue{remaining.length === 1 ? '' : 's'} still flagged after revision; check before sending.</span>}
      </div>
      {issues.length > 0 && <div>{issues.map(issueRow)}</div>}
      {review.revised && remaining.length > 0 && (
        <div>
          <div style={{ ...sectionLabel, color: 'var(--danger)', marginBottom: 4 }}>STILL FLAGGED</div>
          {remaining.map(issueRow)}
        </div>
      )}
      <PostingFlags flags={review.postingFlags} />
      {review.revised && review.firstDraft && (
        <div>
          <button onClick={() => setShowDraft(!showDraft)} style={{ ...ghostBtn, fontSize: 12 }}>{showDraft ? 'Hide first draft' : 'Show first draft'}</button>
          {showDraft && <p style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--muted)', whiteSpace: 'pre-wrap', marginTop: 10 }}>{review.firstDraft}</p>}
        </div>
      )}
    </div>
  )
}
