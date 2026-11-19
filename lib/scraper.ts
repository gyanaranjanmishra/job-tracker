import { load } from 'cheerio'
import { v4 as uuidv4 } from 'uuid'
import { readJobs, saveJob, readScraperConfig, writeScraperConfig } from './storage'
import type { Job } from './storage'

// ── Helpers ───────────────────────────────────────────

function makeJob(partial: Partial<Job>): Job {
  const now = new Date().toISOString()
  return {
    id: uuidv4(),
    title: partial.title || 'Unknown Title',
    company: partial.company || 'Unknown Company',
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

function normalizeKey(title: string, company: string): string {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim()
  return `${norm(title)}|${norm(company)}`
}

function dedup(incoming: Job[], existing: Job[]): Job[] {
  const existingUrls = new Set(existing.map(j => j.url).filter(Boolean))
  const existingKeys = new Set(existing.map(j => normalizeKey(j.title, j.company)))

  const result: Job[] = []
  for (const j of incoming) {
    const key = normalizeKey(j.title, j.company)
    if (j.url && existingUrls.has(j.url)) continue
    if (existingKeys.has(key)) continue
    existingKeys.add(key)
    if (j.url) existingUrls.add(j.url)
    result.push(j)
  }
  return result
}

function matchesKeywords(job: Job, keywords: string[]): boolean {
  if (keywords.length === 0) return true
  const text = `${job.title} ${job.description}`.toLowerCase()
  return keywords.some(kw => kw.trim() && text.includes(kw.toLowerCase().trim()))
}

const HEADERS = { 'User-Agent': 'JobTracker/1.0 (personal job search tool)' }

export interface SourceResult {
  source: string
  fetched: number
  error?: string
}

// ── Public API Sources ────────────────────────────────

async function scrapeRemotive(keywords: string[]): Promise<{ jobs: Job[]; error?: string }> {
  try {
    const query = keywords.join(' ')
    const url = `https://remotive.com/api/remote-jobs${query ? `?search=${encodeURIComponent(query)}` : ''}`
    const res = await fetch(url, { headers: HEADERS })
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

async function scrapeArbeitnow(keywords: string[]): Promise<{ jobs: Job[]; error?: string }> {
  try {
    const query = keywords.join(' ')
    const url = `https://www.arbeitnow.com/api/job-board-api${query ? `?search=${encodeURIComponent(query)}` : ''}`
    const res = await fetch(url, { headers: HEADERS })
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

async function scrapeTheMuse(keywords: string[]): Promise<{ jobs: Job[]; error?: string }> {
  try {
    const query = keywords[0] || ''
    const url = `https://www.themuse.com/api/public/jobs?${query ? `category=${encodeURIComponent(query)}&` : ''}page=0&descending=true`
    const res = await fetch(url, { headers: HEADERS })
    if (!res.ok) return { jobs: [], error: `HTTP ${res.status}` }
    const data = await res.json() as { results?: any[] }
    const jobs = (data.results || []).map((j: any) => makeJob({
      title: j.name,
      company: j.company?.name || '',
      location: (j.locations || []).map((l: any) => l.name).join(', '),
      url: j.refs?.landing_page || '',
      description: stripHtml(j.contents || ''),
    }))
    return { jobs }
  } catch (e: any) {
    return { jobs: [], error: e.message }
  }
}

async function scrapeAdzuna(keywords: string[]): Promise<{ jobs: Job[]; error?: string }> {
  const appId = process.env.ADZUNA_APP_ID
  const appKey = process.env.ADZUNA_APP_KEY
  if (!appId || !appKey) {
    return { jobs: [], error: 'Missing ADZUNA_APP_ID or ADZUNA_APP_KEY in environment' }
  }

  const allJobs: Job[] = []
  const errors: string[] = []

  for (const keyword of keywords) {
    try {
      const url = [
        `https://api.adzuna.com/v1/api/jobs/ca/search/1`,
        `?app_id=${appId}&app_key=${appKey}`,
        `&results_per_page=20`,
        `&what=${encodeURIComponent(keyword)}`,
        `&where=toronto&distance=50`,
        `&content-type=application/json`,
      ].join('')
      const res = await fetch(url, { headers: HEADERS })
      if (!res.ok) {
        const body = await res.text().catch(() => '')
        errors.push(`[${keyword}] HTTP ${res.status}${body ? ': ' + body.slice(0, 120) : ''}`)
        continue
      }
      const data = await res.json() as { results?: any[] }
      allJobs.push(...(data.results || []).map((j: any) => makeJob({
        title: j.title,
        company: j.company?.display_name || '',
        location: j.location?.display_name || 'Toronto, ON',
        url: j.redirect_url,
        description: j.description || '',
      })))
    } catch (e: any) {
      errors.push(`[${keyword}] ${e.message}`)
    }
  }

  return { jobs: allJobs, error: errors.length ? errors.join('; ') : undefined }
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

export async function runScraper(personaId: string): Promise<{ added: number; jobs: Job[]; sources: SourceResult[] }> {
  const config = readScraperConfig(personaId)
  if (!config.enabled) return { added: 0, jobs: [], sources: [] }
  if (config.keywords.length === 0 && config.companies.length === 0) {
    return { added: 0, jobs: [], sources: [{ source: 'config', fetched: 0, error: 'No keywords or companies configured' }] }
  }

  const existing = readJobs(personaId)
  const collected: Job[] = []
  const sourceResults: SourceResult[] = []

  async function run(name: string, fn: () => Promise<{ jobs: Job[]; error?: string }>) {
    const { jobs, error } = await fn()
    sourceResults.push({ source: name, fetched: jobs.length, error })
    if (error) console.error(`[Scraper] ${name}: ${error}`)
    collected.push(...jobs)
  }

  if (config.sources.remotive) await run('Remotive', () => scrapeRemotive(config.keywords))
  if (config.sources.arbeitnow) await run('Arbeitnow', () => scrapeArbeitnow(config.keywords))
  if (config.sources.themuse)   await run('TheMuse',   () => scrapeTheMuse(config.keywords))
  if (config.sources.adzuna)    await run('Adzuna',    () => scrapeAdzuna(config.keywords))

  for (const company of config.companies.filter(c => c.enabled)) {
    if (company.type === 'greenhouse') {
      await run(`Greenhouse:${company.name}`, () => scrapeGreenhouse(company.slug, company.name))
    } else if (company.type === 'lever') {
      await run(`Lever:${company.name}`, () => scrapeLever(company.slug, company.name))
    } else if (company.type === 'url') {
      await run(`Direct:${company.name}`, () => scrapeDirectUrl(company.slug, company.name))
    }
  }

  // Filter to Canada / India / Remote only
  const CANADA  = /canada|ontario|toronto|vancouver|montreal|calgary|ottawa|winnipeg|edmonton|\bbc\b|alberta|nova scotia|new brunswick|saskatchewan/i
  const INDIA   = /india|bengaluru|bangalore|mumbai|delhi|hyderabad|chennai|pune|noida|gurugram|gurgaon|kolkata|ahmedabad|jaipur|kochi/i
  const REMOTE  = /remote|anywhere|worldwide|global|work from home|distributed/i

  const locationFiltered = collected.filter(j => {
    const loc = j.location || ''
    if (!loc) return true  // no location info — keep it
    return CANADA.test(loc) || INDIA.test(loc) || REMOTE.test(loc)
  })

  const filtered = config.keywords.length > 0
    ? locationFiltered.filter(j => matchesKeywords(j, config.keywords))
    : locationFiltered

  const newJobs = dedup(filtered, existing)
  for (const job of newJobs) saveJob(personaId, job)

  writeScraperConfig(personaId, { ...config, lastRun: new Date().toISOString() })
  return { added: newJobs.length, jobs: newJobs, sources: sourceResults }
}
