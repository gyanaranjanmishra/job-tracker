import fs from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { DEMO_MODE } from './demo'

// Real data lives in data/ (gitignored). Demo mode works on a scratch copy of
// sample-data/ in .demo-data/ (also gitignored), so the committed samples stay clean.
// Delete .demo-data/ to reset the demo.
const DATA_DIR = path.join(process.cwd(), DEMO_MODE ? '.demo-data' : 'data')
const SAMPLE_DIR = path.join(process.cwd(), 'sample-data')
if (!fs.existsSync(DATA_DIR)) {
  if (DEMO_MODE && fs.existsSync(SAMPLE_DIR)) fs.cpSync(SAMPLE_DIR, DATA_DIR, { recursive: true })
  else fs.mkdirSync(DATA_DIR, { recursive: true })
}

// ── Types ──────────────────────────────────────────────

export type JobStatus = 'saved' | 'applied' | 'interview' | 'offer' | 'rejected'

export interface ChecklistItem {
  id: string
  item: string
  done: boolean
}

export interface ATSAnalysis {
  summary: string
  matchedKeywords: string[]
  missingKeywords: string[]
  improvedSummary: string
  suggestions: Array<{ section: string; original?: string; improved: string }>
  analyzedAt: string
}

export interface Job {
  id: string
  title: string
  company: string
  location: string
  url: string
  description: string
  status: JobStatus
  notes: string
  appliedDate: string
  createdAt: string
  updatedAt: string
  fitScore?: number
  keywords?: string[]
  atsAnalysis?: ATSAnalysis
  regionId?: string
  roleId?: string
  checklist?: ChecklistItem[]
}

export interface ResumeEntry {
  id: string
  name: string
  regionId?: string
  roleId?: string
  text: string
  updatedAt: string
}

export interface BoardEntry {
  id: string
  name: string
  url: string
  enabled: boolean
}

export interface RegionConfig {
  id: string
  name: string
  boards: BoardEntry[]
}

export interface RoleConfig {
  id: string
  name: string
  resumeId?: string
  regionId?: string
}

export interface LearningSkill {
  name: string
  count: number
  missingCount: number
  matchedCount: number
  jobIds: string[]
}

export interface LearningEntry {
  role: string
  skills: LearningSkill[]
}

export interface Persona {
  id: string
  name: string
  createdAt: string
}

export interface AppSettings {
  personas: Persona[]
  checklistTemplate: { id: string; item: string }[]
}

export interface CompanyEntry {
  id: string
  name: string
  type: 'greenhouse' | 'lever' | 'url'
  slug: string
  enabled: boolean
}

export interface ScraperConfig {
  keywords: string[]
  sources: { remotive: boolean; arbeitnow: boolean; themuse: boolean; adzuna: boolean }
  companies: CompanyEntry[]
  interval: 'hourly' | '6h' | 'daily' | 'weekly'
  enabled: boolean
  lastRun: string
}

// ── Path helpers ──────────────────────────────────────

export function personaDir(personaId: string): string {
  const dir = path.join(DATA_DIR, 'personas', personaId)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json')

// ── Defaults ──────────────────────────────────────────

const DEFAULT_CHECKLIST_TEMPLATE = [
  { id: uuidv4(), item: 'Tailor resume to job description' },
  { id: uuidv4(), item: 'Write cover letter' },
  { id: uuidv4(), item: 'Update LinkedIn profile' },
  { id: uuidv4(), item: 'Submit application' },
  { id: uuidv4(), item: 'Follow up after 1 week' },
]

export function makeDefaultRegions(): RegionConfig[] {
  return [
    {
      id: uuidv4(), name: 'Canada',
      boards: [
        { id: uuidv4(), name: 'Job Bank Canada', url: 'https://www.jobbank.gc.ca', enabled: true },
        { id: uuidv4(), name: 'Workopolis', url: 'https://www.workopolis.com', enabled: true },
        { id: uuidv4(), name: 'Eluta', url: 'https://www.eluta.ca', enabled: true },
        { id: uuidv4(), name: 'Jobillico', url: 'https://www.jobillico.com', enabled: false },
        { id: uuidv4(), name: 'OhCanadaJobs', url: 'https://ohcanadajobs.com', enabled: false },
      ],
    },
    {
      id: uuidv4(), name: 'India',
      boards: [
        { id: uuidv4(), name: 'Naukri', url: 'https://www.naukri.com', enabled: true },
        { id: uuidv4(), name: 'CutShort', url: 'https://cutshort.io', enabled: true },
        { id: uuidv4(), name: 'Hirect', url: 'https://hirect.in', enabled: true },
        { id: uuidv4(), name: 'Freshersworld', url: 'https://www.freshersworld.com', enabled: false },
        { id: uuidv4(), name: 'Internshala', url: 'https://internshala.com', enabled: false },
        { id: uuidv4(), name: 'Apna', url: 'https://apna.co', enabled: false },
      ],
    },
    {
      id: uuidv4(), name: 'Remote',
      boards: [
        { id: uuidv4(), name: 'Remotive', url: 'https://remotive.com', enabled: true },
        { id: uuidv4(), name: 'We Work Remotely', url: 'https://weworkremotely.com', enabled: true },
        { id: uuidv4(), name: 'Himalayas', url: 'https://himalayas.app', enabled: true },
        { id: uuidv4(), name: 'Wellfound', url: 'https://wellfound.com', enabled: false },
        { id: uuidv4(), name: 'Arbeitnow', url: 'https://www.arbeitnow.com', enabled: false },
      ],
    },
  ]
}

const DEFAULT_SCRAPER_CONFIG: ScraperConfig = {
  keywords: [],
  sources: { remotive: true, arbeitnow: false, themuse: false, adzuna: true },
  companies: [],
  interval: 'daily',
  enabled: false,
  lastRun: '',
}

// ── Migration ─────────────────────────────────────────

function migrate(): void {
  if (fs.existsSync(SETTINGS_FILE)) return

  const personaId = uuidv4()
  const persona: Persona = { id: personaId, name: 'Default', createdAt: new Date().toISOString() }
  const settings: AppSettings = { personas: [persona], checklistTemplate: DEFAULT_CHECKLIST_TEMPLATE }
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2))

  const dir = personaDir(personaId)

  const oldJobsFile = path.join(DATA_DIR, 'jobs.json')
  if (fs.existsSync(oldJobsFile)) {
    fs.copyFileSync(oldJobsFile, path.join(dir, 'jobs.json'))
  } else {
    fs.writeFileSync(path.join(dir, 'jobs.json'), JSON.stringify([], null, 2))
  }

  const oldResumeFile = path.join(DATA_DIR, 'resume.json')
  if (fs.existsSync(oldResumeFile)) {
    try {
      const old = JSON.parse(fs.readFileSync(oldResumeFile, 'utf-8'))
      const resumes: ResumeEntry[] = [{
        id: uuidv4(), name: 'My Resume',
        text: old.baseResume || '',
        updatedAt: old.updatedAt || new Date().toISOString(),
      }]
      fs.writeFileSync(path.join(dir, 'resumes.json'), JSON.stringify(resumes, null, 2))
    } catch {
      fs.writeFileSync(path.join(dir, 'resumes.json'), JSON.stringify([], null, 2))
    }
  } else {
    fs.writeFileSync(path.join(dir, 'resumes.json'), JSON.stringify([], null, 2))
  }

  const oldConfigFile = path.join(DATA_DIR, 'scraper-config.json')
  if (fs.existsSync(oldConfigFile)) {
    fs.copyFileSync(oldConfigFile, path.join(dir, 'scraper-config.json'))
  } else {
    fs.writeFileSync(path.join(dir, 'scraper-config.json'), JSON.stringify(DEFAULT_SCRAPER_CONFIG, null, 2))
  }

  fs.writeFileSync(path.join(dir, 'regions.json'), JSON.stringify(makeDefaultRegions(), null, 2))
  fs.writeFileSync(path.join(dir, 'roles.json'), JSON.stringify([], null, 2))
  fs.writeFileSync(path.join(dir, 'learning.json'), JSON.stringify([], null, 2))
}

migrate()

// ── App Settings ──────────────────────────────────────

export function readSettings(): AppSettings {
  if (!fs.existsSync(SETTINGS_FILE)) migrate()
  return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'))
}

export function writeSettings(settings: AppSettings): void {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2))
}

export function getPersonas(): Persona[] {
  return readSettings().personas
}

export function getDefaultPersonaId(): string {
  return readSettings().personas[0]?.id || ''
}

export function addPersona(name: string): Persona {
  const settings = readSettings()
  const persona: Persona = { id: uuidv4(), name, createdAt: new Date().toISOString() }
  settings.personas.push(persona)
  writeSettings(settings)

  const dir = personaDir(persona.id)
  fs.writeFileSync(path.join(dir, 'jobs.json'), JSON.stringify([], null, 2))
  fs.writeFileSync(path.join(dir, 'resumes.json'), JSON.stringify([], null, 2))
  fs.writeFileSync(path.join(dir, 'regions.json'), JSON.stringify(makeDefaultRegions(), null, 2))
  fs.writeFileSync(path.join(dir, 'roles.json'), JSON.stringify([], null, 2))
  fs.writeFileSync(path.join(dir, 'scraper-config.json'), JSON.stringify(DEFAULT_SCRAPER_CONFIG, null, 2))
  fs.writeFileSync(path.join(dir, 'learning.json'), JSON.stringify([], null, 2))

  return persona
}

export function deletePersona(personaId: string): void {
  const settings = readSettings()
  settings.personas = settings.personas.filter(p => p.id !== personaId)
  writeSettings(settings)
}

// ── Jobs ──────────────────────────────────────────────

export function readJobs(personaId: string): Job[] {
  const file = path.join(personaDir(personaId), 'jobs.json')
  if (!fs.existsSync(file)) return []
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')) } catch { return [] }
}

export function writeJobs(personaId: string, jobs: Job[]): void {
  fs.writeFileSync(path.join(personaDir(personaId), 'jobs.json'), JSON.stringify(jobs, null, 2))
}

export function getJob(personaId: string, id: string): Job | undefined {
  return readJobs(personaId).find(j => j.id === id)
}

export function saveJob(personaId: string, job: Job): void {
  const jobs = readJobs(personaId)
  const idx = jobs.findIndex(j => j.id === job.id)
  if (idx >= 0) jobs[idx] = job
  else jobs.unshift(job)
  writeJobs(personaId, jobs)
}

export function deleteJob(personaId: string, id: string): void {
  writeJobs(personaId, readJobs(personaId).filter(j => j.id !== id))
}

// ── Resumes ───────────────────────────────────────────

export function readResumes(personaId: string): ResumeEntry[] {
  const file = path.join(personaDir(personaId), 'resumes.json')
  if (!fs.existsSync(file)) return []
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')) } catch { return [] }
}

export function writeResumes(personaId: string, resumes: ResumeEntry[]): void {
  fs.writeFileSync(path.join(personaDir(personaId), 'resumes.json'), JSON.stringify(resumes, null, 2))
}

export function saveResume(personaId: string, entry: ResumeEntry): void {
  const resumes = readResumes(personaId)
  const idx = resumes.findIndex(r => r.id === entry.id)
  if (idx >= 0) resumes[idx] = entry
  else resumes.push(entry)
  writeResumes(personaId, resumes)
}

export function deleteResume(personaId: string, id: string): void {
  writeResumes(personaId, readResumes(personaId).filter(r => r.id !== id))
}

export function getBestResume(personaId: string, regionId?: string, roleId?: string): ResumeEntry | undefined {
  const resumes = readResumes(personaId)
  if (!resumes.length) return undefined
  if (regionId && roleId) {
    const exact = resumes.find(r => r.regionId === regionId && r.roleId === roleId)
    if (exact) return exact
  }
  if (roleId) {
    const byRole = resumes.find(r => r.roleId === roleId)
    if (byRole) return byRole
  }
  if (regionId) {
    const byRegion = resumes.find(r => r.regionId === regionId)
    if (byRegion) return byRegion
  }
  return resumes[0]
}

// Legacy compat for analyze/coverletter routes
export function readResume(personaId: string): { baseResume: string; updatedAt: string } {
  const resumes = readResumes(personaId)
  if (!resumes.length) return { baseResume: '', updatedAt: '' }
  return { baseResume: resumes[0].text, updatedAt: resumes[0].updatedAt }
}

// ── Regions ───────────────────────────────────────────

export function readRegions(personaId: string): RegionConfig[] {
  const file = path.join(personaDir(personaId), 'regions.json')
  if (!fs.existsSync(file)) return []
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')) } catch { return [] }
}

export function writeRegions(personaId: string, regions: RegionConfig[]): void {
  fs.writeFileSync(path.join(personaDir(personaId), 'regions.json'), JSON.stringify(regions, null, 2))
}

// ── Roles ─────────────────────────────────────────────

export function readRoles(personaId: string): RoleConfig[] {
  const file = path.join(personaDir(personaId), 'roles.json')
  if (!fs.existsSync(file)) return []
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')) } catch { return [] }
}

export function writeRoles(personaId: string, roles: RoleConfig[]): void {
  fs.writeFileSync(path.join(personaDir(personaId), 'roles.json'), JSON.stringify(roles, null, 2))
}

// ── Scraper Config ────────────────────────────────────

export function readScraperConfig(personaId: string): ScraperConfig {
  const file = path.join(personaDir(personaId), 'scraper-config.json')
  if (!fs.existsSync(file)) return { ...DEFAULT_SCRAPER_CONFIG }
  try { return { ...DEFAULT_SCRAPER_CONFIG, ...JSON.parse(fs.readFileSync(file, 'utf-8')) } }
  catch { return { ...DEFAULT_SCRAPER_CONFIG } }
}

export function writeScraperConfig(personaId: string, config: ScraperConfig): void {
  fs.writeFileSync(path.join(personaDir(personaId), 'scraper-config.json'), JSON.stringify(config, null, 2))
}

// ── Learning ──────────────────────────────────────────

export function readLearning(personaId: string): LearningEntry[] {
  const file = path.join(personaDir(personaId), 'learning.json')
  if (!fs.existsSync(file)) return []
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')) } catch { return [] }
}

export function writeLearning(personaId: string, data: LearningEntry[]): void {
  fs.writeFileSync(path.join(personaDir(personaId), 'learning.json'), JSON.stringify(data, null, 2))
}

export function updateLearningFromJob(personaId: string, job: Job): void {
  if (!job.atsAnalysis) return

  const roles = readRoles(personaId)
  const jobTitleLower = job.title.toLowerCase()

  const matchingRoleNames = roles.length > 0
    ? roles.filter(r => jobTitleLower.includes(r.name.toLowerCase()) || r.name.toLowerCase().split(' ').some(w => w.length > 3 && jobTitleLower.includes(w)))
        .map(r => r.name)
    : [job.title]

  const learning = readLearning(personaId)

  const missingSkills = job.atsAnalysis.missingKeywords || []
  const matchedSkills = job.atsAnalysis.matchedKeywords || []

  for (const roleName of matchingRoleNames) {
    let entry = learning.find(e => e.role === roleName)
    if (!entry) {
      entry = { role: roleName, skills: [] }
      learning.push(entry)
    }

    const addSkill = (skillName: string, isMissing: boolean) => {
      const existing = entry!.skills.find(s => s.name.toLowerCase() === skillName.toLowerCase())
      if (existing) {
        if (!existing.jobIds.includes(job.id)) {
          existing.count++
          existing.jobIds.push(job.id)
          if (isMissing) existing.missingCount++
          else existing.matchedCount++
        }
      } else {
        entry!.skills.push({
          name: skillName,
          count: 1,
          missingCount: isMissing ? 1 : 0,
          matchedCount: isMissing ? 0 : 1,
          jobIds: [job.id],
        })
      }
    }

    missingSkills.forEach(s => addSkill(s, true))
    matchedSkills.forEach(s => addSkill(s, false))

    entry.skills.sort((a, b) => b.count - a.count)
  }

  writeLearning(personaId, learning)
}
