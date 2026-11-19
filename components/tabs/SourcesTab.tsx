'use client'
import { useState, useEffect } from 'react'
import type { ScraperConfig, CompanyEntry, ResumeEntry, RegionConfig, RoleConfig } from '@/lib/storage'
import { labelStyle, inputStyle, selectStyle, primaryBtn, ghostBtn, dangerBtn, card, sectionLabel, Field, Toggle } from '@/components/ui'

// ── Sources Tab ───────────────────────────────────────
export function SourcesTab({ fw, onJobsAdded, checklistTemplate, onChecklistTemplateUpdate, onRegionsRolesChange }: {
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
  const [scrapeResult, setScrapeResult] = useState<{ added: number; skippedDuplicate?: number; skippedInvalid?: number; byRole?: Record<string, number>; sources?: { source: string; fetched: number; error?: string }[] } | null>(null)
  const [tagInfo, setTagInfo] = useState<{ untagged: number; assignable: number; byRole: Record<string, number> } | null>(null)
  const [tagMessage, setTagMessage] = useState('')
  const [editingKeywords, setEditingKeywords] = useState('')
  const [scrapeError, setScrapeError] = useState('')
  const [showAddCompany, setShowAddCompany] = useState(false)
  const [companyForm, setCompanyForm] = useState({ name: '', type: 'greenhouse' as CompanyEntry['type'], slug: '' })
  const [regions, setRegions] = useState<RegionConfig[]>([])
  const [roles, setRoles] = useState<RoleConfig[]>([])
  const [resumes, setResumes] = useState<ResumeEntry[]>([])
  const [showAddRegion, setShowAddRegion] = useState(false)
  const [newRegionName, setNewRegionName] = useState('')
  const [showAddRole, setShowAddRole] = useState(false)
  const [newRoleForm, setNewRoleForm] = useState({ name: '', regionId: '', resumeId: '', keywords: '' })
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
    loadTagInfo()
  }, [])

  const loadTagInfo = () => fw('/api/jobs/assign-roles').then((r: Response) => r.json()).then(setTagInfo).catch(() => setTagInfo(null))

  const tagExistingJobs = async () => {
    const res = await fw('/api/jobs/assign-roles', { method: 'POST' })
    const data = await res.json()
    setTagMessage(`✓ Tagged ${data.assigned} job${data.assigned === 1 ? '' : 's'} with a role.`)
    setTimeout(() => setTagMessage(''), 4000)
    loadTagInfo(); onJobsAdded()
  }

  const splitTerms = (text: string) => text.split(/[,\n]/).map(k => k.trim()).filter(Boolean)
  const area = config.adzuna || { country: 'ca', where: 'Toronto', distance: 50 }
  const setArea = (patch: Partial<typeof area>) => setConfig(c => ({ ...c, adzuna: { ...area, ...patch } }))

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
      else { setScrapeResult(data); onJobsAdded(); loadTagInfo(); fw('/api/scrape/config').then((r: Response) => r.json()).then(setConfig) }
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
    const res = await fw('/api/roles', { method: 'POST', body: JSON.stringify({ ...newRoleForm, keywords: splitTerms(newRoleForm.keywords) }) })
    const role = await res.json()
    setRoles(prev => [...prev, role]); setNewRoleForm({ name: '', regionId: '', resumeId: '', keywords: '' }); setShowAddRole(false); onRegionsRolesChange(); loadTagInfo()
  }

  const saveRole = async (role: RoleConfig) => {
    const res = await fw('/api/roles', { method: 'PUT', body: JSON.stringify({ ...role, keywords: splitTerms(editingKeywords) }) })
    const saved: RoleConfig = await res.json()
    setRoles(prev => prev.map(r => r.id === saved.id ? saved : r)); setEditingRole(null); onRegionsRolesChange(); loadTagInfo()
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
            {scrapeResult.added > 0 ? `✓ Added ${scrapeResult.added} new job${scrapeResult.added === 1 ? '' : 's'} to your pipeline.` : '✓ Scrape complete: no new jobs found.'}
            {(scrapeResult.skippedDuplicate || scrapeResult.skippedInvalid) ? (
              <span style={{ color: 'var(--muted)' }}>
                {' '}Skipped {scrapeResult.skippedDuplicate || 0} already tracked and {scrapeResult.skippedInvalid || 0} with missing title or company.
              </span>
            ) : null}
            {scrapeResult.byRole && Object.keys(scrapeResult.byRole).length > 0 && (
              <div style={{ color: 'var(--text)', marginTop: 4 }}>
                By role: {Object.entries(scrapeResult.byRole).map(([name, n]) => `${name} ${n}`).join(' · ')}
              </div>
            )}
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
          The scraper searches every role&apos;s keywords plus the general keywords below, and tags each new job with the role it matches,
          so it is scored against that role&apos;s resume. Adzuna searches the area you set; other sources are filtered to Canada, India and Remote.
          Duplicates across portals are removed automatically.
        </p>
      </div>

      {/* Keywords */}
      <div style={card}>
        <div style={sectionLabel}>GENERAL KEYWORDS</div>
        <label style={labelStyle}>Keywords not tied to a role (comma-separated)</label>
        <input value={keywordsText} onChange={e => setKeywordsText(e.target.value)} placeholder="e.g. python, business intelligence" style={inputStyle} />
        <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>Add search keywords to each role in the Roles section below. Jobs must contain at least one keyword.</p>
      </div>

      {/* API job boards */}
      <div style={card}>
        <div style={sectionLabel}>API JOB SOURCES</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {([
            { key: 'adzuna', label: 'Adzuna', desc: 'Broadest coverage, including engineering and trades. Searched once per keyword in the area below. Requires ADZUNA_APP_ID + ADZUNA_APP_KEY in .env.local' },
            { key: 'remotive', label: 'Remotive', desc: 'Remote tech jobs only. Free API.' },
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
        {config.sources.adzuna && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: 10, marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
            <div>
              <label style={labelStyle}>Adzuna country</label>
              <select value={area.country} onChange={e => setArea({ country: e.target.value })} style={selectStyle}>
                {[['ca', 'Canada'], ['us', 'United States'], ['gb', 'United Kingdom'], ['in', 'India'], ['au', 'Australia'], ['de', 'Germany'], ['fr', 'France'], ['nl', 'Netherlands'], ['sg', 'Singapore']]
                  .map(([code, name]) => <option key={code} value={code}>{name}</option>)}
              </select>
            </div>
            <Field label="City or area (empty = whole country)" value={area.where} onChange={v => setArea({ where: v })} placeholder="Toronto" />
            <Field label="Radius (km)" type="number" value={String(area.distance)} onChange={v => setArea({ distance: Number(v) || 0 })} placeholder="50" />
          </div>
        )}
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
            <div style={{ marginBottom: 10 }}>
              <Field label="Search keywords (comma-separated)" value={newRoleForm.keywords} onChange={v => setNewRoleForm(f => ({ ...f, keywords: v }))} placeholder="Materials Engineer, Metallurgist, Metallurgical Engineer" />
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
                  <div style={{ marginBottom: 10 }}>
                    <Field label="Search keywords (comma-separated)" value={editingKeywords} onChange={setEditingKeywords} placeholder="Materials Engineer, Metallurgist" />
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
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                      {(role.keywords || []).map(k => (
                        <span key={k} style={{ fontSize: 11, fontFamily: 'DM Mono, monospace', background: '#eeedff', color: 'var(--accent)', border: '1px solid var(--accent)33', borderRadius: 4, padding: '1px 8px' }}>{k}</span>
                      ))}
                      {!(role.keywords || []).length && <span style={{ fontSize: 11, color: 'var(--muted)' }}>No search keywords: jobs are tagged by role name only</span>}
                    </div>
                  </div>
                  <button onClick={() => { setEditingRole(role); setEditingKeywords((role.keywords || []).join(', ')) }} style={{ ...ghostBtn, fontSize: 12, padding: '4px 10px' }}>Edit</button>
                  <button onClick={() => { if (confirm('Delete role?')) deleteRole(role.id) }} style={dangerBtn}>Delete</button>
                </div>
              )}
            </div>
          ))}
          {roles.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 13 }}>No roles yet. Add roles to enable resume auto-selection and learning tracking.</p>}
        </div>
        {tagInfo && tagInfo.untagged > 0 && roles.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            <div style={{ flex: 1, fontSize: 12, color: 'var(--muted)' }}>
              {tagInfo.untagged} tracked job{tagInfo.untagged === 1 ? ' has' : 's have'} no role.{' '}
              {tagInfo.assignable > 0
                ? <>Keywords match {tagInfo.assignable}: {Object.entries(tagInfo.byRole).map(([n, c]) => `${n} ${c}`).join(' · ')}.</>
                : 'None match a role name or keyword yet.'}
            </div>
            {tagMessage && <span style={{ fontSize: 12, color: 'var(--accent3)' }}>{tagMessage}</span>}
            <button onClick={tagExistingJobs} disabled={!tagInfo.assignable} style={{ ...ghostBtn, fontSize: 12, padding: '5px 12px', opacity: tagInfo.assignable ? 1 : 0.5 }}>Tag {tagInfo.assignable} job{tagInfo.assignable === 1 ? '' : 's'}</button>
          </div>
        )}
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
