// Pure helpers for job identity, cleanup and de-duplication.
// No file or network access here, so everything is easy to unit test.

import type { Job, JobStatus } from './storage'

// ── Normalisation ─────────────────────────────────────

const LEGAL_SUFFIXES = /\b(inc|incorporated|ltd|limited|llc|llp|plc|corp|corporation|co|company|gmbh|ag|sa|bv|pvt|private)\b/g

function norm(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '') // strip accents
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

// Regional arms of one employer often post the same job ("WSP", "WSP Canada", "WSP USA")
// but "Bank of Canada" names an organisation, so keep a country that follows of/and/the/for.
const COUNTRY_SUFFIX = /\s(canada|usa|us|united states|uk|united kingdom|india|north america)$/
const PART_OF_NAME = /\b(of|and|the|for)\s(canada|usa|us|united states|uk|united kingdom|india|north america)$/

export function normalizeCompany(company: string): string {
  const base = norm(company).replace(LEGAL_SUFFIXES, ' ').replace(/\s+/g, ' ').trim()
  if (PART_OF_NAME.test(base)) return base
  return base.replace(COUNTRY_SUFFIX, '').trim() || base
}

export function normalizeTitle(title: string): string {
  return norm(title)
    .replace(/\b(m|f|d|w|x)( (m|f|d|w|x))+\b/g, ' ') // "(m/f/d)", "(f/x/m)" gender tags
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Canonical identity of a posting: normalised company + title.
 * Two postings with the same key are treated as the same job, even if a job
 * board re-lists them under a new ID or URL (Adzuna does this often).
 */
export function jobKey(title: string, company: string): string {
  return `${normalizeCompany(company)}|${normalizeTitle(title)}`
}

const TRACKING_PARAMS = /^(utm_.*|ref|referrer|source|src|gh_src|lever-source|trk|trackingid|fbclid|gclid)$/i

/** Strip tracking parameters, fragments and trailing slashes so the same link compares equal. */
export function canonicalUrl(url: string): string {
  if (!url) return ''
  try {
    const u = new URL(url.trim())
    u.hash = ''
    for (const k of Array.from(u.searchParams.keys())) {
      if (TRACKING_PARAMS.test(k)) u.searchParams.delete(k)
    }
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, '')
    return u.toString().replace(/\/(\?|$)/, '$1')
  } catch {
    return url.trim()
  }
}

// ── Field cleanup and validation ──────────────────────

// Labels that some sources leak into the company field, e.g. "Description Chubb"
const JUNK_PREFIX = /^(description|company( name)?|employer|about( us)?|hiring company)\s*[:\-–]?\s+/i

const ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' }

function cleanText(s: string, max: number): string {
  return (s || '')
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, m => ENTITIES[m] || m)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

export function cleanCompany(company: string): string {
  const c = cleanText(company, 120)
  const stripped = c.replace(JUNK_PREFIX, '').trim()
  return stripped || c
}

/** Tidy the free-text fields a scraper or form produced. Returns a new object. */
export function cleanJobFields<T extends Partial<Job>>(job: T): T {
  return {
    ...job,
    title: cleanText(job.title || '', 200),
    company: cleanCompany(job.company || ''),
    location: cleanText(job.location || '', 200),
    url: (job.url || '').trim(),
  }
}

/** Reasons a job should not be stored. Empty array means it is valid. */
export function validateJob(job: Partial<Job>): string[] {
  const errors: string[] = []
  const title = (job.title || '').trim()
  const company = (job.company || '').trim()
  if (!title || /^unknown title$/i.test(title)) errors.push('missing title')
  if (!company || /^unknown company$/i.test(company)) errors.push('missing company')
  if (title.length < 3) errors.push('title too short')
  if (job.url) {
    try {
      const u = new URL(job.url)
      if (!/^https?:$/.test(u.protocol)) errors.push('url must be http(s)')
    } catch {
      errors.push('invalid url')
    }
  }
  return errors
}

// ── Duplicate detection and merging ───────────────────

export function findDuplicate(candidate: Pick<Job, 'title' | 'company' | 'url'>, existing: Job[]): Job | undefined {
  const key = jobKey(candidate.title, candidate.company)
  const url = canonicalUrl(candidate.url)
  return existing.find(j => jobKey(j.title, j.company) === key || (!!url && canonicalUrl(j.url) === url))
}

/** Filter incoming jobs down to ones that match neither an existing job nor an earlier incoming one. */
export function dedupIncoming(incoming: Job[], existing: Job[]): Job[] {
  const keys = new Set(existing.map(j => jobKey(j.title, j.company)))
  const urls = new Set(existing.map(j => canonicalUrl(j.url)).filter(Boolean))
  const out: Job[] = []
  for (const j of incoming) {
    const key = jobKey(j.title, j.company)
    const url = canonicalUrl(j.url)
    if (keys.has(key) || (url && urls.has(url))) continue
    keys.add(key)
    if (url) urls.add(url)
    out.push(j)
  }
  return out
}

// How far along the pipeline a status is; the further one wins when merging.
const STATUS_RANK: Record<JobStatus, number> = { saved: 0, applied: 1, rejected: 2, interview: 3, offer: 4 }

function richness(j: Job): number {
  return (
    STATUS_RANK[j.status] * 1_000_000 +
    (j.atsAnalysis ? 100_000 : 0) +
    (j.fitScore !== undefined ? 10_000 : 0) +
    (j.checklist?.filter(c => c.done).length || 0) * 1_000 +
    Math.min(j.description?.length || 0, 999)
  )
}

/** Combine a group of duplicates into one job, keeping the most complete data from each. */
export function mergeJobs(group: Job[]): Job {
  const sorted = [...group].sort((a, b) => richness(b) - richness(a))
  const base: Job = { ...sorted[0] }
  for (const other of sorted.slice(1)) {
    if ((other.description?.length || 0) > (base.description?.length || 0)) base.description = other.description
    if (base.fitScore === undefined && other.fitScore !== undefined) base.fitScore = other.fitScore
    if (!base.atsAnalysis && other.atsAnalysis) base.atsAnalysis = other.atsAnalysis
    if (!base.keywords?.length && other.keywords?.length) base.keywords = other.keywords
    if (!base.appliedDate && other.appliedDate) base.appliedDate = other.appliedDate
    if (!base.regionId && other.regionId) base.regionId = other.regionId
    if (!base.roleId && other.roleId) base.roleId = other.roleId
    if (other.notes && !base.notes.includes(other.notes)) base.notes = [base.notes, other.notes].filter(Boolean).join('\n')
    if (base.checklist && other.checklist) {
      const done = new Set(other.checklist.filter(c => c.done).map(c => c.item))
      base.checklist = base.checklist.map(c => (done.has(c.item) ? { ...c, done: true } : c))
    }
  }
  // Keep the earliest "first seen" date
  base.createdAt = group.map(j => j.createdAt).sort()[0]
  return base
}

export interface DedupResult {
  jobs: Job[]
  removed: number
  groups: Array<{ kept: string; removed: string[]; key: string }>
}

/** Collapse duplicates in a full job list (same canonical key or same canonical URL). */
export function dedupExisting(jobs: Job[]): DedupResult {
  // Union-find over key and URL so A~B by key and B~C by URL end up in one group
  const parent = jobs.map((_, i) => i)
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])))
  const union = (a: number, b: number) => { parent[find(a)] = find(b) }
  const byKey = new Map<string, number>()
  const byUrl = new Map<string, number>()
  jobs.forEach((j, i) => {
    const k = jobKey(j.title, j.company)
    const u = canonicalUrl(j.url)
    if (byKey.has(k)) union(i, byKey.get(k)!); else byKey.set(k, i)
    if (u) { if (byUrl.has(u)) union(i, byUrl.get(u)!); else byUrl.set(u, i) }
  })

  const groups = new Map<number, Job[]>()
  jobs.forEach((j, i) => {
    const r = find(i)
    if (!groups.has(r)) groups.set(r, [])
    groups.get(r)!.push(j)
  })

  const out: Job[] = []
  const report: DedupResult['groups'] = []
  const emitted = new Set<number>()
  // Preserve the original order: emit each group where its first member appeared
  jobs.forEach((_, i) => {
    const r = find(i)
    if (emitted.has(r)) return
    emitted.add(r)
    const g = groups.get(r)!
    if (g.length === 1) { out.push(g[0]); return }
    const merged = mergeJobs(g)
    out.push(merged)
    report.push({ kept: merged.id, removed: g.filter(j => j.id !== merged.id).map(j => j.id), key: jobKey(merged.title, merged.company) })
  })
  return { jobs: out, removed: jobs.length - out.length, groups: report }
}
