'use client'
import type { Job, RegionConfig, RoleConfig } from '@/lib/storage'
import { STATUS_CONFIG, card, sectionLabel, EmptyState } from '@/components/ui'

// ── Dashboard Tab ─────────────────────────────────────
export function DashboardTab({ jobs, regions, roles }: { jobs: Job[]; regions: RegionConfig[]; roles: RoleConfig[] }) {
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
