// Multi-criteria fit rubric.
//
// The model rates each dimension 0-10 with a one-line reason and lists any
// deal-breakers the posting explicitly triggers. The overall 0-100 fit score is
// computed here, in code, from the user's weights, so it is reproducible and the
// user can see exactly why a job scored what it did.

import { z } from 'zod'

export const DIMENSIONS = ['skills', 'experience', 'seniority', 'location', 'goals'] as const
export type Dimension = (typeof DIMENSIONS)[number]

export const DIMENSION_LABELS: Record<Dimension, string> = {
  skills: 'Skills match',
  experience: 'Experience & domain',
  seniority: 'Seniority fit',
  location: 'Location & work mode',
  goals: 'Career priorities',
}

export const DIMENSION_GUIDE: Record<Dimension, string> = {
  skills: 'How many of the required and preferred skills/tools in the posting the resume clearly demonstrates.',
  experience: 'Relevance of the candidate\'s past roles, domain and years of experience to what the role needs.',
  seniority: 'Whether the role\'s level matches the candidate\'s target seniority (penalise both under- and over-levelling).',
  location: 'Whether the job\'s location and on-site/hybrid/remote arrangement fits the candidate\'s preferred locations.',
  goals: 'How well the role matches the candidate\'s stated career priorities.',
}

/** A deal-breaker hit caps the overall score at this value. */
export const DEAL_BREAKER_CAP = 25

export interface FitProfile {
  targetSeniority: string
  preferredLocations: string[]
  dealBreakers: string[]
  priorities: string
  weights: Record<Dimension, number>
  updatedAt?: string
}

export const DEFAULT_PROFILE: FitProfile = {
  targetSeniority: 'Mid-level to senior individual contributor',
  preferredLocations: ['Remote'],
  dealBreakers: [],
  priorities: '',
  weights: { skills: 35, experience: 25, seniority: 15, location: 15, goals: 10 },
}

// ── Schemas for structured model output ───────────────

const dimensionScore = z.object({
  score: z.number().describe('0 (no fit) to 10 (excellent fit)'),
  reason: z.string().describe('One short sentence citing the evidence'),
})

export const RubricSchema = z.object({
  dimensions: z.object({
    skills: dimensionScore,
    experience: dimensionScore,
    seniority: dimensionScore,
    location: dimensionScore,
    goals: dimensionScore,
  }),
  dealBreakersHit: z.array(z.object({
    dealBreaker: z.string().describe('The deal-breaker exactly as the candidate wrote it'),
    evidence: z.string().describe('Short quote from the posting that triggers it'),
  })).describe('Only deal-breakers the posting explicitly triggers; empty if none'),
  oneLine: z.string().describe('One-sentence verdict on the fit'),
})

export const DeepAnalysisSchema = RubricSchema.extend({
  matchedKeywords: z.array(z.string()),
  missingKeywords: z.array(z.string()),
  summary: z.string().describe('2-3 sentence assessment'),
  improvedSummary: z.string().describe('Rewritten professional summary tailored to this role, using only facts from the resume'),
  suggestions: z.array(z.object({
    section: z.string(),
    original: z.string().describe('Original text, or empty string'),
    improved: z.string(),
  })),
})

export type RubricOutput = z.infer<typeof RubricSchema>
export type DeepAnalysisOutput = z.infer<typeof DeepAnalysisSchema>

export interface RubricResult extends RubricOutput {
  score: number
  weights: Record<Dimension, number>
  mode: 'triage' | 'deep'
  model: string
  at: string
}

// ── Scoring ───────────────────────────────────────────

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number.isFinite(n) ? n : lo))

/** Weighted average of the dimension scores, scaled to 0-100, capped if a deal-breaker is hit. */
export function computeFitScore(output: RubricOutput, weights: Record<Dimension, number>): number {
  let total = 0
  let weightSum = 0
  for (const d of DIMENSIONS) {
    const w = clamp(weights[d] ?? 0, 0, 100)
    total += w * clamp(output.dimensions[d].score, 0, 10)
    weightSum += w
  }
  const score = weightSum ? Math.round((total / weightSum) * 10) : 0
  return output.dealBreakersHit.length ? Math.min(score, DEAL_BREAKER_CAP) : score
}

export function normaliseProfile(p: Partial<FitProfile> | undefined): FitProfile {
  const weights = { ...DEFAULT_PROFILE.weights, ...(p?.weights || {}) }
  for (const d of DIMENSIONS) weights[d] = clamp(Number(weights[d]), 0, 100)
  return {
    targetSeniority: (p?.targetSeniority ?? DEFAULT_PROFILE.targetSeniority).toString().slice(0, 200),
    preferredLocations: (p?.preferredLocations ?? DEFAULT_PROFILE.preferredLocations).map(String).map(s => s.trim()).filter(Boolean).slice(0, 20),
    dealBreakers: (p?.dealBreakers ?? []).map(String).map(s => s.trim()).filter(Boolean).slice(0, 20),
    priorities: (p?.priorities ?? '').toString().slice(0, 1000),
    weights,
    updatedAt: typeof p?.updatedAt === 'string' ? p.updatedAt : undefined,
  }
}

/** A job needs (re-)triage if it has no rubric score, or was scored before the preferences last changed. */
export function needsTriage(job: { description?: string; fitScore?: number; rubric?: { at: string } }, profileUpdatedAt?: string): boolean {
  if (!job.description?.trim()) return false
  if (job.fitScore === undefined || !job.rubric) return true
  return !!profileUpdatedAt && job.rubric.at < profileUpdatedAt
}

/** The candidate-preferences block used in prompts. */
export function profilePrompt(p: FitProfile): string {
  return [
    `Target seniority: ${p.targetSeniority || 'not specified'}`,
    `Preferred locations / work modes: ${p.preferredLocations.join('; ') || 'not specified'}`,
    `Deal-breakers: ${p.dealBreakers.length ? p.dealBreakers.map(d => `"${d}"`).join('; ') : 'none'}`,
    `Career priorities: ${p.priorities || 'not specified'}`,
  ].join('\n')
}

export function rubricInstructions(): string {
  return [
    'Rate the job on each dimension from 0 to 10:',
    ...DIMENSIONS.map(d => `- ${d}: ${DIMENSION_GUIDE[d]}`),
    'Use the full range: 5 means an average, partial fit. Base every rating on evidence in the posting and resume.',
    'If the posting does not mention something (for example location), give a neutral 5 and say it is not stated.',
    'List a deal-breaker only when the posting explicitly states it; do not infer.',
  ].join('\n')
}
