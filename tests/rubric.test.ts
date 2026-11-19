import { describe, expect, it } from 'vitest'
import {
  computeFitScore, DEAL_BREAKER_CAP, DEFAULT_PROFILE, DIMENSIONS, needsTriage, normaliseProfile, profilePrompt,
  RubricSchema, type RubricOutput,
} from '@/lib/rubric'

function rubric(scores: number[], dealBreakers: string[] = []): RubricOutput {
  const dimensions = Object.fromEntries(DIMENSIONS.map((d, i) => [d, { score: scores[i], reason: 'r' }])) as RubricOutput['dimensions']
  return { dimensions, dealBreakersHit: dealBreakers.map(d => ({ dealBreaker: d, evidence: 'e' })), oneLine: '' }
}

const equal = { skills: 20, experience: 20, seniority: 20, location: 20, goals: 20 }

describe('computeFitScore', () => {
  it('is the weighted average scaled to 0-100', () => {
    expect(computeFitScore(rubric([10, 10, 10, 10, 10]), equal)).toBe(100)
    expect(computeFitScore(rubric([0, 0, 0, 0, 0]), equal)).toBe(0)
    expect(computeFitScore(rubric([10, 0, 0, 0, 0]), equal)).toBe(20)
    // default weights 35/25/15/15/10
    expect(computeFitScore(rubric([8, 6, 10, 4, 2]), DEFAULT_PROFILE.weights)).toBe(Math.round((35 * 8 + 25 * 6 + 15 * 10 + 15 * 4 + 10 * 2) / 100 * 10))
  })

  it('does not require weights to sum to 100', () => {
    const doubled = { skills: 70, experience: 50, seniority: 30, location: 30, goals: 20 }
    const r = rubric([7, 5, 9, 3, 6])
    expect(computeFitScore(r, doubled)).toBe(computeFitScore(r, DEFAULT_PROFILE.weights))
  })

  it('clamps out-of-range ratings and weights', () => {
    expect(computeFitScore(rubric([15, 15, 15, 15, 15]), equal)).toBe(100)
    expect(computeFitScore(rubric([-3, 10, 10, 10, 10]), { ...equal, skills: -50 })).toBe(100)
    expect(computeFitScore(rubric([5, 5, 5, 5, 5]), { skills: 0, experience: 0, seniority: 0, location: 0, goals: 0 })).toBe(0)
  })

  it('caps the score when a deal-breaker is hit', () => {
    expect(computeFitScore(rubric([10, 10, 10, 10, 10], ['on-site only']), equal)).toBe(DEAL_BREAKER_CAP)
    expect(computeFitScore(rubric([1, 1, 1, 1, 1], ['on-site only']), equal)).toBe(10)
  })
})

describe('normaliseProfile', () => {
  it('fills defaults for a missing profile', () => {
    expect(normaliseProfile(undefined)).toMatchObject({ ...DEFAULT_PROFILE, updatedAt: undefined })
  })

  it('cleans lists, merges partial weights and keeps updatedAt', () => {
    const p = normaliseProfile({
      preferredLocations: [' Toronto ', '', 'Remote'],
      dealBreakers: ['  ', 'clearance'],
      weights: { skills: 500 } as any,
      updatedAt: '2026-05-01T00:00:00Z',
    })
    expect(p.preferredLocations).toEqual(['Toronto', 'Remote'])
    expect(p.dealBreakers).toEqual(['clearance'])
    expect(p.weights.skills).toBe(100)
    expect(p.weights.experience).toBe(DEFAULT_PROFILE.weights.experience)
    expect(p.updatedAt).toBe('2026-05-01T00:00:00Z')
  })

  it('renders the preferences block for prompts', () => {
    const text = profilePrompt(normaliseProfile({ dealBreakers: ['clearance'] }))
    expect(text).toContain('Deal-breakers: "clearance"')
    expect(profilePrompt(normaliseProfile({}))).toContain('Deal-breakers: none')
  })
})

describe('needsTriage', () => {
  const at = '2026-03-01T00:00:00.000Z'
  it('needs a description', () => {
    expect(needsTriage({ description: '  ' })).toBe(false)
  })
  it('re-scores jobs with no score or an old-style score without a rubric', () => {
    expect(needsTriage({ description: 'x' })).toBe(true)
    expect(needsTriage({ description: 'x', fitScore: 50 })).toBe(true)
  })
  it('re-scores only when preferences changed after the rubric', () => {
    const job = { description: 'x', fitScore: 50, rubric: { at } }
    expect(needsTriage(job)).toBe(false)
    expect(needsTriage(job, '2026-02-01T00:00:00.000Z')).toBe(false)
    expect(needsTriage(job, '2026-04-01T00:00:00.000Z')).toBe(true)
  })
})

describe('RubricSchema', () => {
  it('accepts a well-formed rubric and rejects a missing dimension', () => {
    expect(RubricSchema.safeParse(rubric([1, 2, 3, 4, 5])).success).toBe(true)
    const bad = rubric([1, 2, 3, 4, 5]) as any
    delete bad.dimensions.goals
    expect(RubricSchema.safeParse(bad).success).toBe(false)
  })
})
