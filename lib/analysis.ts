// Two-stage job analysis.
//   triage: rubric scores only, low effort. Cheap enough to run on every job.
//   deep:   rubric + ATS keywords + rewritten summary + section suggestions,
//           for the shortlist (Top K) or a single job in the ATS tab.
// Both run the posting guard first and wrap untrusted text in tags.

import { callStructured, MODEL, tagged, UNTRUSTED_POSTING_RULE } from './ai'
import { DEMO_MODE, mockDeep, mockRubric } from './demo'
import { guardPosting, type GuardFinding } from './guard'
import {
  computeFitScore, DeepAnalysisSchema, profilePrompt, RubricSchema, rubricInstructions,
  type DeepAnalysisOutput, type FitProfile, type RubricResult,
} from './rubric'

export interface AnalysisInput {
  jobDescription: string
  resumeText: string
  profile: FitProfile
  title?: string
  company?: string
  location?: string
}

export interface TriageResult {
  fitScore: number
  rubric: RubricResult
  postingFlags: GuardFinding[]
}

export interface DeepResult extends TriageResult {
  matchedKeywords: string[]
  missingKeywords: string[]
  summary: string
  improvedSummary: string
  suggestions: DeepAnalysisOutput['suggestions']
}

const SYSTEM =
  'You are an experienced technical recruiter assessing how well one candidate fits a job. ' +
  'Be specific and honest; a weak fit should score low. ' + UNTRUSTED_POSTING_RULE

function buildPrompt(input: AnalysisInput, postingText: string, task: string): string {
  const heading = [
    input.title && `Job title: ${input.title}`,
    input.company && `Company: ${input.company}`,
    input.location && `Listed location: ${input.location}`,
  ].filter(Boolean).join('\n')
  return [
    'CANDIDATE PREFERENCES (written by the candidate):',
    profilePrompt(input.profile),
    '',
    tagged('resume', input.resumeText),
    '',
    heading,
    tagged('job_posting', postingText),
    '',
    rubricInstructions(),
    '',
    task,
  ].filter(s => s !== undefined).join('\n')
}

function toRubric(output: Parameters<typeof computeFitScore>[0], profile: FitProfile, mode: 'triage' | 'deep'): RubricResult {
  return {
    dimensions: output.dimensions,
    dealBreakersHit: output.dealBreakersHit,
    oneLine: output.oneLine,
    score: computeFitScore(output, profile.weights),
    weights: profile.weights,
    mode,
    model: DEMO_MODE ? 'demo' : MODEL,
    at: new Date().toISOString(),
  }
}

export async function triageJob(input: AnalysisInput): Promise<TriageResult> {
  const guard = guardPosting(input.jobDescription)
  const output = DEMO_MODE
    ? mockRubric(guard.text, input.resumeText, input.profile, input.title, input.location)
    : await callStructured({
        schema: RubricSchema,
        system: SYSTEM,
        user: buildPrompt(input, guard.text, 'Return the rubric ratings, any deal-breakers hit, and a one-sentence verdict.'),
        effort: 'low',
        maxTokens: 4000,
      })
  const rubric = toRubric(output, input.profile, 'triage')
  return { fitScore: rubric.score, rubric, postingFlags: guard.findings }
}

export async function deepAnalyzeJob(input: AnalysisInput): Promise<DeepResult> {
  const guard = guardPosting(input.jobDescription)
  const output = DEMO_MODE
    ? mockDeep(guard.text, input.resumeText, input.profile, input.title, input.location)
    : await callStructured({
        schema: DeepAnalysisSchema,
        system: SYSTEM,
        user: buildPrompt(
          input,
          guard.text,
          [
            'Then do a full ATS review:',
            '- matchedKeywords: skills, tools and qualifications from the posting that the resume already shows.',
            '- missingKeywords: important ones from the posting that the resume lacks (most important first).',
            '- summary: a 2-3 sentence assessment.',
            '- improvedSummary: a professional summary tailored to this role. Use only facts present in the resume; never invent experience.',
            '- suggestions: up to 5 concrete edits, each naming the resume section, the original text (or empty) and the improved text.',
          ].join('\n'),
        ),
        effort: 'medium',
        maxTokens: 12000,
      })
  const rubric = toRubric(output, input.profile, 'deep')
  return {
    fitScore: rubric.score,
    rubric,
    postingFlags: guard.findings,
    matchedKeywords: output.matchedKeywords,
    missingKeywords: output.missingKeywords,
    summary: output.summary,
    improvedSummary: output.improvedSummary,
    suggestions: output.suggestions,
  }
}
