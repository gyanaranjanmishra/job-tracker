import { describe, expect, it } from 'vitest'
import { assignRole, matchesAnyTerm, parseTerms, searchTerms } from '@/lib/roles'
import type { RoleConfig } from '@/lib/storage'

const roles: RoleConfig[] = [
  { id: 'ds', name: 'Data Scientist', keywords: ['Data Scientist', 'Machine Learning Scientist'] },
  { id: 'mat', name: 'Materials Engineer', keywords: ['Materials Engineer', 'Metallurgist', 'Metallurgical Engineer', 'Corrosion Engineer'] },
  { id: 'qa', name: 'Quality Engineer' },
]

describe('parseTerms', () => {
  it('splits on commas and newlines, trims and de-duplicates', () => {
    expect(parseTerms(' Metallurgist, materials engineer\nMETALLURGIST,, ')).toEqual(['Metallurgist', 'materials engineer'])
  })
})

describe('searchTerms', () => {
  it('lists role keywords tagged with their role, then general keywords', () => {
    expect(searchTerms(['python', 'metallurgist'], roles)).toEqual([
      { term: 'Data Scientist', roleId: 'ds' },
      { term: 'Machine Learning Scientist', roleId: 'ds' },
      { term: 'Materials Engineer', roleId: 'mat' },
      { term: 'Metallurgist', roleId: 'mat' },
      { term: 'Metallurgical Engineer', roleId: 'mat' },
      { term: 'Corrosion Engineer', roleId: 'mat' },
      { term: 'python', roleId: undefined },
    ])
  })

  it('works with no roles', () => {
    expect(searchTerms(['a', 'b'], [])).toEqual([{ term: 'a' }, { term: 'b' }].map(t => ({ ...t, roleId: undefined })))
  })
})

describe('assignRole', () => {
  it('matches the title first', () => {
    expect(assignRole({ title: 'Senior Metallurgist' }, roles)).toBe('mat')
    expect(assignRole({ title: 'Data Scientists (2 openings)' }, roles)).toBe('ds')
    expect(assignRole({ title: 'Quality Engineer II' }, roles)).toBe('qa')
  })

  it('prefers the longest matching term in the title', () => {
    const overlapping: RoleConfig[] = [
      { id: 'eng', name: 'Engineer' },
      { id: 'mat', name: 'Materials', keywords: ['Materials Engineer'] },
    ]
    expect(assignRole({ title: 'Materials Engineer' }, overlapping)).toBe('mat')
  })

  it('falls back to the role whose keyword found the job', () => {
    expect(assignRole({ title: 'Process Specialist', description: 'heat treatment' }, roles, 'metallurgist')).toBe('mat')
  })

  it('then to the role mentioned most in the description', () => {
    const job = { title: 'Specialist', description: 'You will work with the metallurgist and corrosion engineer teams.' }
    expect(assignRole(job, roles)).toBe('mat')
  })

  it('returns undefined when nothing matches', () => {
    expect(assignRole({ title: 'Barista', description: 'coffee' }, roles)).toBeUndefined()
    expect(assignRole({ title: 'Metallurgist' }, [])).toBeUndefined()
  })

  it('does not match inside other words', () => {
    expect(assignRole({ title: 'Reengineering Lead' }, [{ id: 'e', name: 'Engineer' }])).toBeUndefined()
  })
})

describe('matchesAnyTerm', () => {
  it('matches any term in title or description, case-insensitively', () => {
    expect(matchesAnyTerm({ title: 'Welding Engineer', description: 'Report to the METALLURGIST.' }, ['metallurgist'])).toBe(true)
    expect(matchesAnyTerm({ title: 'Data Analyst', description: '' }, ['metallurgist', 'materials engineer'])).toBe(false)
    expect(matchesAnyTerm({ title: 'Anything' }, [])).toBe(true)
  })
})
