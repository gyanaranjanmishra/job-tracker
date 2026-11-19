'use client'
import { useState } from 'react'
import type { JobStatus, RegionConfig, RoleConfig } from '@/lib/storage'
import { STATUS_CONFIG, labelStyle, inputStyle, selectStyle, primaryBtn, ghostBtn, card, Field } from '@/components/ui'

// ── Add Job Form ──────────────────────────────────────
export function AddJobForm({ onSave, onCancel, regions, roles }: { onSave: (d: any) => void; onCancel: () => void; regions: RegionConfig[]; roles: RoleConfig[] }) {
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
