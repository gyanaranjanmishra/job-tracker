import { load } from 'cheerio'
import { v4 as uuidv4 } from 'uuid'
import { readJobs, readRoles, saveJob, readScraperConfig, writeScraperConfig, DEFAULT_ADZUNA } from './storage'
import type { AdzunaSettings, Job } from './storage'
import { cleanJobFields, dedupIncoming, validateJob } from './jobs'
import { assignRole, matchesAnyTerm, searchTerms } from './roles'

// ── Helpers ───────────────────────────────────────────

function makeJob(raw: Partial<Job>): Job {
  const now = new Date().toISOString()
  const partial = cleanJobFields(raw)
  return {
    id: uuidv4(),
    title: partial.title || '',
    company: partial.company || '',
    location: partial.location || '',
    url: partial.url || '',
    description: partial.description || '',
    status: 'saved',
    notes: '',
    appliedDate: '',
    createdAt: now,
    updatedAt: now,
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s{2,}/g, ' ').trim()
}

const HEADERS = { 'User-Agent': 'JobTracker/1.0 (personal job search tool)' }

export interface SourceResult {
  source: string
  fetched: number
  error?: string
}

// ── Public API Sources ────────────────────────────────
// Remotive, Arbeitnow and The Muse are fetched once without a search query and
// filtered locally against every keyword: joining several role keywords into
// one search string returns poor results. Adzuna is searched once per keyword.

type SourceFn = () => Promise<{ jobs: Job[]; error?: string }>

async function scrapeRemotive(): Promise<{ jobs: Job[]; error?: string }> {
  try {
    const res = await fetch('https://remotive.com/api/remote-jobs', { headers: HEADERS })
    if (!res.ok) return { jobs: [], error: `HTTP ${res.status}` }
    const data = await res.json() as { jobs?: any[] }
    const jobs = (data.jobs || []).map((j: any) => makeJob({
      title: j.title,
      company: j.company_name,
      location: j.candidate_required_location || 'Remote',
      url: j.url,
      description: stripHtml(j.description || ''),
    }))
    return { jobs }
  } catch (e: any) {
    return { jobs: [], error: e.message }
  }
}

async function scrapeArbeitnow(): Promise<{ jobs: Job[]; error?: string }> {
  try {
    const res = await fetch('https://www.arbeitnow.com/api/job-board-api', { headers: HEADERS })
    if (!res.ok) return { jobs: [], error: `HTTP ${res.status}` }
    const data = await res.json() as { data?: any[] }
    const jobs = (data.data || []).map((j: any) => makeJob({
      title: j.title,
      company: j.company_name,
      location: j.location || 'Remote',
      url: j.url,
      description: stripHtml(j.description || ''),
    }))
    return { jobs }
  } catch (e: any) {
    return { jobs: [], error: e.message }
  }
}

async function scrapeTheMuse(): Promise<{ jobs: Job[]; error?: string }> {
  try {
    const all: Job[] = []
    for (const page of [0, 1]) {
      const res = await fetch(`https://www.themuse.com/api/public/jobs?page=${page}&descending=true`, { headers: HEADERS })
      if (!res.ok) return { jobs: all, error: `HTTP ${res.status}` }
      const data = await res.json() as { results?: any[] }
      all.push(...(data.results || []).map((j: any) => makeJob({
        title: j.name,
        company: j.company?.name || '',
        location: (j.locations || []).map((l: any) => l.name).join(', '),
        url: j.refs?.landing_page || '',
        description: stripHtml(j.contents || ''),
      })))
    }
    return { jobs: all }
  } catch (e: any) {
    return { jobs: [], error: e.message }
  }
}

/** One Adzuna search for one keyword, in the configured country and area. */
async function scrapeAdzuna(keyword: string, area: AdzunaSettings): Promise<{ jobs: Job[]; error?: string }> {
  const appId = process.env.ADZUNA_APP_ID
  const appKey = process.env.ADZUNA_APP_KEY
  if (!appId || !appKey) return { jobs: [], error: 'Missing ADZUNA_APP_ID or ADZUNA_APP_KEY in environment' }
  const country = (area.country || 'ca').toLowerCase().replace(/[^a-z]/g, '')
  try {
    const params = new URLSearchParams({
      app_id: appId, app_key: appKey, results_per_page: '50', what_phrase: keyword, 'content-type': 'application/json',
    })
    if (area.where.trim()) {
      params.set('where', area.where.trim())
      params.set('distance', String(Math.max(1, Math.round(area.distance || 50))))
    }
    const res = await fetch(`https://api.adzuna.com/v1/api/jobs/${country}/search/1?${params}`, { headers: HEADERS })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      return { jobs: [], error: `[${keyword}] HTTP ${res.status}${body ? ': ' + body.slice(0, 120) : ''}` }
    }
    const data = await res.json() as { results?: any[] }
    const jobs = (data.results || []).map((j: any) => makeJob({
      title: j.title,
      company: j.company?.display_name || '',
      location: j.location?.display_name || area.where,
      url: j.redirect_url,
      description: stripHtml(j.description || ''),
    }))
    return { jobs }
  } catch (e: any) {
    return { jobs: [], error: `[${keyword}] ${e.message}` }
  }
}

// ── Company Sources ───────────────────────────────────

async function scrapeGreenhouse(slug: string, companyName: string): Promise<{ jobs: Job[]; error?: string }> {
  try {
    const url = `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`
    const res = await fetch(url, { headers: HEADERS })
    if (!res.ok) return { jobs: [], error: `HTTP ${res.status}` }
    const data = await res.json() as { jobs?: any[] }
    const jobs = (data.jobs || []).map((j: any) => makeJob({
      title: j.title, company: companyName,
      location: j.location?.name || '',
      url: j.absolute_url,
      description: stripHtml(j.content || ''),
    }))
    return { jobs }
  } catch (e: any) {
    return { jobs: [], error: e.message }
  }
}

async function scrapeLever(slug: string, companyName: string): Promise<{ jobs: Job[]; error?: string }> {
  try {
    const url = `https://api.lever.co/v0/postings/${slug}?mode=json`
    const res = await fetch(url, { headers: HEADERS })
    if (!res.ok) return { jobs: [], error: `HTTP ${res.status}` }
    const data = await res.json()
    const postings = Array.isArray(data) ? data : []
    const jobs = postings.map((j: any) => makeJob({
      title: j.text, company: companyName,
      location: j.categories?.location || j.workplaceType || '',
      url: j.hostedUrl,
      description: j.descriptionPlain || stripHtml(j.description || ''),
    }))
    return { jobs }
  } catch (e: any) {
    return { jobs: [], error: e.message }
  }
}

async function scrapeDirectUrl(url: string, companyName: string): Promise<{ jobs: Job[]; error?: string }> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; JobTracker/1.0)' } })
    if (!res.ok) return { jobs: [], error: `HTTP ${res.status}` }
    const html = await res.text()
    const $ = load(html)
    const jobs: Job[] = []
    const selectors = [
      '[class*="job-listing"]', '[class*="job-card"]', '[class*="job-item"]',
      '[class*="position-item"]', '[class*="opening-item"]',
      'li[data-job-id]', 'article[data-job]',
    ]
    for (const sel of selectors) {
      $(sel).each((_, el) => {
        const title = $(el).find('h2, h3, [class*="title"], [class*="role"]').first().text().trim()
        const location = $(el).find('[class*="location"]').first().text().trim()
        const href = $(el).find('a').first().attr('href') || ''
        const jobUrl = href.startsWith('http') ? href : href ? new URL(href, url).href : url
        if (title) jobs.push(makeJob({ title, company: companyName, location, url: jobUrl }))
      })
      if (jobs.length > 0) break
    }
    return { jobs }
  } catch (e: any) {
    return { jobs: [], error: e.message }
  }
}

// ── Main Runner ───────────────────────────────────────

// Jobs from sources that are not location-targeted are kept only for these
// locations. Adzuna results are kept as-is: it searches the area you configure.
const CANADA = /canada|ontario|toronto|vancouver|montreal|calgary|ottawa|winnipeg|edmonton|\bbc\b|alberta|nova scotia|new brunswick|saskatchewan|quebec|manitoba|hamilton/i
const INDIA = /india|bengaluru|bangalore|mumbai|delhi|hyderabad|chennai|pune|noida|gurugram|gurgaon|kolkata|ahmedabad|jaipur|kochi/i
const REMOTE = /remote|anywhere|worldwide|global|work from home|distributed/i

export interface ScrapeResult {
  added: number
  jobs: Job[]
  sources: SourceResult[]
  skippedInvalid?: number
  skippedDuplicate?: number
  /** New jobs per role name ("Unassigned" when no role matched). */
  byRole?: Record<string, number>
}

export async function runScraper(personaId: string): Promise<ScrapeResult> {
  const config = readScraperConfig(personaId)
  const roles = readRoles(personaId)
  const terms = searchTerms(config.keywords, roles)
  const companies = config.companies.filter(c => c.enabled)
  if (terms.length === 0 && companies.length === 0) {
    return { added: 0, jobs: [], sources: [{ source: 'config', fetched: 0, error: 'No keywords, role keywords or companies configured' }] }
  }

  const existing = readJobs(personaId)
  const collected: Array<{ job: Job; foundBy?: string; areaTargeted: boolean }> = []
  const sourceResults: SourceResult[] = []

  async function run(name: string, fn: SourceFn, opts: { foundBy?: string; areaTargeted?: boolean } = {}) {
    const { jobs, error } = await fn()
    const entry = sourceResults.find(s => s.source === name)
    if (entry) {
      entry.fetched += jobs.length
      if (error) entry.error = [entry.error, error].filter(Boolean).join('; ')
    } else sourceResults.push({ source: name, fetched: jobs.length, error })
    if (error) console.error(`[Scraper] ${name}: ${error}`)
    for (const job of jobs) collected.push({ job, foundBy: opts.foundBy, areaTargeted: !!opts.areaTargeted })
  }

  if (terms.length) {
    if (config.sources.remotive) await run('Remotive', scrapeRemotive)
    if (config.sources.arbeitnow) await run('Arbeitnow', scrapeArbeitnow)
    if (config.sources.themuse) await run('TheMuse', scrapeTheMuse)
    if (config.sources.adzuna) {
      const area = config.adzuna || DEFAULT_ADZUNA
      for (const t of terms) await run('Adzuna', () => scrapeAdzuna(t.term, area), { foundBy: t.term, areaTargeted: true })
    }
  }

  for (const company of config.companies.filter(c => c.enabled)) {
    if (company.type === 'greenhouse') {
      await run(`Greenhouse:${company.name}`, () => scrapeGreenhouse(company.slug, company.name))
    } else if (company.type === 'lever') {
      await run(`Lever:${company.name}`, () => scrapeLever(company.slug, company.name))
    } else if (company.type === 'url') {
      await run(`Direct:${company.name}`, () => scrapeDirectUrl(company.slug, company.name))
    }
  }

  const termList = terms.map(t => t.term)
  const filtered = collected.filter(({ job, areaTargeted }) => {
    const loc = job.location || ''
    const locationOk = areaTargeted || !loc || CANADA.test(loc) || INDIA.test(loc) || REMOTE.test(loc)
    return locationOk && matchesAnyTerm(job, termList)
  })

  // Tag each job with its role (and that role's region) so it is scored against the right resume
  const tagged = filtered.map(({ job, foundBy }) => {
    const roleId = assignRole(job, roles, foundBy)
    const role = roles.find(r => r.id === roleId)
    return { ...job, roleId, regionId: job.regionId || role?.regionId }
  })

  const valid = tagged.filter(j => validateJob(j).length === 0)
  const newJobs = dedupIncoming(valid, existing)
  for (const job of newJobs) saveJob(personaId, job)

  const byRole: Record<string, number> = {}
  for (const j of newJobs) {
    const name = roles.find(r => r.id === j.roleId)?.name || 'Unassigned'
    byRole[name] = (byRole[name] || 0) + 1
  }

  writeScraperConfig(personaId, { ...config, lastRun: new Date().toISOString() })
  return {
    added: newJobs.length, jobs: newJobs, sources: sourceResults,
    skippedInvalid: tagged.length - valid.length,
    skippedDuplicate: valid.length - newJobs.length,
    byRole,
  }
}
