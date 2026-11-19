import { describe, expect, it } from 'vitest'
import {
  canonicalUrl, cleanCompany, cleanJobFields, dedupExisting, dedupIncoming, findDuplicate, jobKey, mergeJobs,
  normalizeCompany, normalizeTitle, validateJob,
} from '@/lib/jobs'
import { makeJob } from './helpers'

describe('normalisation', () => {
  it('drops legal suffixes, accents and punctuation from company names', () => {
    expect(normalizeCompany('Acme, Inc.')).toBe('acme')
    expect(normalizeCompany('Acme Ltd')).toBe('acme')
    expect(normalizeCompany('Zürich Versicherung AG')).toBe('zurich versicherung')
    expect(normalizeCompany('Procter & Gamble Co.')).toBe('procter and gamble')
  })

  it('drops gender tags from titles', () => {
    expect(normalizeTitle('Data Scientist (m/f/d)')).toBe('data scientist')
    expect(normalizeTitle('Data Scientist (f/x/m)')).toBe('data scientist')
    expect(normalizeTitle('Senior  Data-Scientist')).toBe('senior data scientist')
  })

  it('gives re-listings of the same posting the same key', () => {
    expect(jobKey('Data Scientist (m/w/d)', 'Acme GmbH')).toBe(jobKey('data scientist', 'ACME'))
    expect(jobKey('Data Scientist', 'Acme')).not.toBe(jobKey('Data Analyst', 'Acme'))
  })
})

describe('canonicalUrl', () => {
  it('removes tracking params, fragments, www and trailing slashes', () => {
    expect(canonicalUrl('https://www.Example.com/jobs/1/?utm_source=x&utm_medium=y#apply'))
      .toBe('https://example.com/jobs/1')
    expect(canonicalUrl('https://example.com/jobs/1?gh_src=abc&id=7')).toBe('https://example.com/jobs/1?id=7')
  })

  it('keeps meaningful params and tolerates bad input', () => {
    expect(canonicalUrl('https://example.com/view?jobId=42')).toBe('https://example.com/view?jobId=42')
    expect(canonicalUrl('')).toBe('')
    expect(canonicalUrl(' not a url ')).toBe('not a url')
  })
})

describe('cleanup and validation', () => {
  it('strips labels and HTML that sources leak into fields', () => {
    expect(cleanCompany('Description Chubb')).toBe('Chubb')
    expect(cleanCompany('Company: Acme')).toBe('Acme')
    expect(cleanCompany('AT&amp;T')).toBe('AT&T')
    const j = cleanJobFields({ title: '<b>Data   Analyst</b>', company: 'Acme', location: ' Remote ', url: ' https://a.co/x ' })
    expect(j).toMatchObject({ title: 'Data Analyst', location: 'Remote', url: 'https://a.co/x' })
  })

  it('rejects jobs without a title, company or valid URL', () => {
    expect(validateJob(makeJob())).toEqual([])
    expect(validateJob(makeJob({ title: '' }))).toContain('missing title')
    expect(validateJob(makeJob({ company: 'Unknown Company' }))).toContain('missing company')
    expect(validateJob(makeJob({ url: 'ftp://x.com/a' }))).toContain('url must be http(s)')
    expect(validateJob(makeJob({ url: 'nope' }))).toContain('invalid url')
  })
})

describe('duplicate detection', () => {
  it('finds an existing job by key or by canonical URL', () => {
    const existing = [makeJob({ title: 'ML Engineer', company: 'Globex', url: 'https://globex.com/jobs/9' })]
    expect(findDuplicate({ title: 'ML Engineer', company: 'Globex Inc.', url: '' }, existing)).toBe(existing[0])
    expect(findDuplicate({ title: 'Other', company: 'Other', url: 'https://globex.com/jobs/9?utm_source=li' }, existing)).toBe(existing[0])
    expect(findDuplicate({ title: 'Other', company: 'Other', url: '' }, existing)).toBeUndefined()
  })

  it('filters incoming jobs against existing ones and each other', () => {
    const existing = [makeJob({ title: 'Data Analyst', company: 'Initech' })]
    const incoming = [
      makeJob({ title: 'Data Analyst', company: 'Initech LLC' }),          // dup of existing
      makeJob({ title: 'Data Engineer', company: 'Initech', url: 'https://i.co/1' }),
      makeJob({ title: 'Data Engineer (m/f/d)', company: 'Initech' }),     // dup of previous incoming
      makeJob({ title: 'Analyst', company: 'Hooli', url: 'https://i.co/1?utm_campaign=z' }), // same URL
      makeJob({ title: 'BI Developer', company: 'Hooli' }),
    ]
    expect(dedupIncoming(incoming, existing).map(j => j.title)).toEqual(['Data Engineer', 'BI Developer'])
  })
})

describe('merging', () => {
  it('keeps the most advanced record and fills gaps from the others', () => {
    const a = makeJob({ id: 'a', status: 'saved', description: 'long description '.repeat(20), notes: 'note A', createdAt: '2026-01-01T00:00:00Z', fitScore: 70 })
    const b = makeJob({ id: 'b', status: 'interview', description: 'short', notes: 'note B', createdAt: '2026-02-01T00:00:00Z', regionId: 'ca' })
    const m = mergeJobs([a, b])
    expect(m.id).toBe('b')
    expect(m.status).toBe('interview')
    expect(m.description).toBe(a.description)
    expect(m.fitScore).toBe(70)
    expect(m.regionId).toBe('ca')
    expect(m.notes).toContain('note A')
    expect(m.notes).toContain('note B')
    expect(m.createdAt).toBe('2026-01-01T00:00:00Z')
  })

  it('merges checklist progress', () => {
    const a = makeJob({ status: 'applied', checklist: [{ item: 'Tailor resume', done: false }, { item: 'Apply', done: true }] as any })
    const b = makeJob({ checklist: [{ item: 'Tailor resume', done: true }, { item: 'Apply', done: false }] as any })
    expect(mergeJobs([a, b]).checklist!.every(c => c.done)).toBe(true)
  })

  it('groups transitively (A~B by key, B~C by URL) and preserves order', () => {
    const jobs = [
      makeJob({ id: 'x', title: 'Unrelated', company: 'Other' }),
      makeJob({ id: 'a', title: 'Data Scientist', company: 'Acme', url: 'https://a.co/1' }),
      makeJob({ id: 'b', title: 'Data Scientist (m/f/d)', company: 'Acme GmbH', url: 'https://a.co/2' }),
      makeJob({ id: 'c', title: 'Senior DS', company: 'Elsewhere', url: 'https://a.co/2?utm_source=x' }),
    ]
    const r = dedupExisting(jobs)
    expect(r.removed).toBe(2)
    expect(r.jobs.map(j => j.id)[0]).toBe('x')
    expect(r.groups).toHaveLength(1)
    expect([r.groups[0].kept, ...r.groups[0].removed].sort()).toEqual(['a', 'b', 'c'])
  })

  it('leaves a list without duplicates unchanged', () => {
    const jobs = [makeJob({ title: 'A1' }), makeJob({ title: 'B2' })]
    expect(dedupExisting(jobs)).toMatchObject({ removed: 0, groups: [], jobs })
  })
})
