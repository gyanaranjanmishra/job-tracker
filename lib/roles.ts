// Role keywords: which search terms to scrape, and which role a job belongs to.
// Pure functions (no file or network access) so they are easy to unit test.

import type { RoleConfig } from './storage'

export interface SearchTerm {
  term: string
  roleId?: string
}

const norm = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9+#]+/g, ' ').trim()

/** Split "a, b,\nc" into trimmed, de-duplicated terms (case-insensitive). */
export function parseTerms(text: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const t of (text || '').split(/[,\n]/)) {
    const term = t.trim()
    const key = norm(term)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(term)
  }
  return out
}

/**
 * Every term the scraper should search for: each role's keywords (tagged with
 * that role), then the general keywords not tied to a role. A term listed by
 * two roles keeps the first role.
 */
export function searchTerms(generalKeywords: string[], roles: RoleConfig[]): SearchTerm[] {
  const seen = new Set<string>()
  const out: SearchTerm[] = []
  const add = (term: string, roleId?: string) => {
    const key = norm(term)
    if (!key || seen.has(key)) return
    seen.add(key)
    out.push({ term: term.trim(), roleId })
  }
  for (const r of roles) for (const k of r.keywords || []) add(k, r.id)
  for (const k of generalKeywords) add(k)
  return out
}

/** Terms that identify a role: its keywords plus its name. */
function roleTerms(role: RoleConfig): string[] {
  return [role.name, ...(role.keywords || [])].map(norm).filter(Boolean)
}

/** Case-insensitive phrase match that starts on a word boundary ("engineer" matches "engineers", not "reengineer"). */
function contains(haystack: string, phrase: string): boolean {
  return ` ${haystack}`.includes(` ${phrase}`)
}

/**
 * Pick the role a job belongs to:
 *   1. a role whose name or keyword appears in the job title (longest match wins),
 *   2. otherwise the role whose keyword found the job in a search,
 *   3. otherwise the role whose terms appear most often in the description.
 * Returns undefined when nothing matches.
 */
export function assignRole(job: { title: string; description?: string }, roles: RoleConfig[], foundBy?: string): string | undefined {
  if (!roles.length) return undefined
  const title = norm(job.title)

  let best: { id: string; len: number } | undefined
  for (const r of roles) {
    for (const t of roleTerms(r)) {
      if (contains(title, t) && (!best || t.length > best.len)) best = { id: r.id, len: t.length }
    }
  }
  if (best) return best.id

  if (foundBy) {
    const f = norm(foundBy)
    const owner = roles.find(r => (r.keywords || []).some(k => norm(k) === f))
    if (owner) return owner.id
  }

  const desc = norm(job.description || '')
  if (!desc) return undefined
  let top: { id: string; hits: number } | undefined
  for (const r of roles) {
    const hits = roleTerms(r).filter(t => contains(desc, t)).length
    if (hits && (!top || hits > top.hits)) top = { id: r.id, hits }
  }
  return top?.id
}

/** Does the job mention at least one term (title or description)? */
export function matchesAnyTerm(job: { title: string; description?: string }, terms: string[]): boolean {
  if (!terms.length) return true
  const text = norm(`${job.title} ${job.description || ''}`)
  return terms.some(t => {
    const n = norm(t)
    return !!n && contains(text, n)
  })
}
