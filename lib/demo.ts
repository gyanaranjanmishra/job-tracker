// Demo mode: lets the app run end to end with no API keys.
//
// Enabled when ANTHROPIC_API_KEY is not set, or when DEMO_MODE=true.
// In demo mode:
//   - data is read from / written to .demo-data/ (seeded from sample-data/), never data/
//   - ATS analysis and cover letters are produced locally by the functions below
//     instead of calling Claude, so results are illustrative, not real model output

import type { DeepAnalysisOutput, FitProfile, RubricOutput } from './rubric'

export const DEMO_MODE = process.env.DEMO_MODE === 'true' || !process.env.ANTHROPIC_API_KEY

// Skills the mock analyzer looks for. Matching is case-insensitive on word boundaries.
const SKILLS = [
  'Python', 'SQL', 'Excel', 'Tableau', 'Power BI', 'Looker', 'dbt', 'Airflow',
  'Spark', 'Snowflake', 'BigQuery', 'Redshift', 'AWS', 'Azure', 'GCP', 'Docker',
  'Kubernetes', 'Git', 'pandas', 'NumPy', 'scikit-learn', 'PyTorch', 'TensorFlow',
  'XGBoost', 'Machine Learning', 'Deep Learning', 'NLP', 'LLM', 'Computer Vision',
  'Statistics', 'A/B testing', 'Experimentation', 'Causal Inference', 'Forecasting',
  'Time Series', 'Regression', 'Classification', 'Feature Engineering', 'ETL',
  'Data Warehousing', 'Data Visualization', 'Dashboard', 'Stakeholder Management',
  'Communication', 'Product Analytics', 'Marketing Analytics', 'MLOps',
]

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function has(text: string, skill: string) {
  return new RegExp(`(^|[^a-z0-9])${escapeRe(skill.toLowerCase())}([^a-z0-9]|$)`).test(text)
}

export interface MockAnalysis {
  fitScore: number
  matchedKeywords: string[]
  missingKeywords: string[]
  summary: string
  improvedSummary: string
  suggestions: Array<{ section: string; original: string; improved: string }>
}

export function mockAnalyze(jobDescription: string, resumeText: string): MockAnalysis {
  const jd = jobDescription.toLowerCase()
  const cv = resumeText.toLowerCase()
  const required = SKILLS.filter(s => has(jd, s))
  const matched = required.filter(s => has(cv, s))
  const missing = required.filter(s => !has(cv, s))

  // Keyword coverage, softened so a JD with few recognised skills does not score 0 or 100
  const coverage = required.length ? matched.length / required.length : 0.5
  const fitScore = Math.round(30 + coverage * 65)

  const top = matched.slice(0, 4).join(', ') || 'core analytics skills'
  const gaps = missing.slice(0, 3)

  return {
    fitScore,
    matchedKeywords: matched,
    missingKeywords: missing,
    summary:
      `[Demo analysis] The resume covers ${matched.length} of ${required.length} skills detected in this posting` +
      (gaps.length ? `; the main gaps are ${gaps.join(', ')}.` : '.') +
      ' Add an API key to get a full Claude-written assessment.',
    improvedSummary:
      `Data professional with hands-on experience in ${top}, focused on turning data into decisions` +
      (gaps.length ? ` and actively building depth in ${gaps.join(', ')}.` : '.'),
    suggestions: gaps.map(g => ({
      section: 'Skills / Experience',
      original: '',
      improved: `If you have used ${g}, add a bullet showing where and with what result; otherwise list it under skills you are developing.`,
    })),
  }
}

// ── Rubric mock ───────────────────────────────────────

const LEVELS: Array<[RegExp, string]> = [
  [/\b(intern|internship|co-?op|student)\b/i, 'intern'],
  [/\b(junior|jr\.?|entry[- ]level|graduate|associate)\b/i, 'junior'],
  [/\b(principal|staff|director|head of|vp)\b/i, 'principal'],
  [/\b(lead|manager)\b/i, 'lead'],
  [/\b(senior|sr\.?)\b/i, 'senior'],
]
const levelOf = (s: string) => LEVELS.find(([re]) => re.test(s))?.[1]

const dim = (score: number, reason: string) => ({ score: Math.max(0, Math.min(10, Math.round(score))), reason })

export function mockRubric(jobDescription: string, resumeText: string, profile: FitProfile, title = '', jobLocation = ''): RubricOutput {
  const jd = `${title}\n${jobLocation}\n${jobDescription}`
  const { matchedKeywords, missingKeywords } = mockAnalyze(jobDescription, resumeText)
  const required = matchedKeywords.length + missingKeywords.length
  const coverage = required ? matchedKeywords.length / required : 0.5

  const jobLevel = levelOf(title) || levelOf(jobDescription.slice(0, 400))
  const wanted = profile.targetSeniority.toLowerCase()
  const seniority = !jobLevel
    ? dim(6, 'Level not stated; assumed mid-level.')
    : wanted.includes(jobLevel) || (jobLevel === 'senior' && /senior/.test(wanted))
      ? dim(9, `Posting is ${jobLevel}-level, matching your target.`)
      : dim(3, `Posting is ${jobLevel}-level; your target is "${profile.targetSeniority}".`)

  const prefs = profile.preferredLocations.map(p => p.toLowerCase())
  const jdLower = jd.toLowerCase()
  const hitLoc = prefs.find(p => p && jdLower.includes(p.replace(/\(.*\)/, '').trim()))
  const location = !prefs.length
    ? dim(5, 'No location preference set.')
    : hitLoc
      ? dim(9, `Matches your preference "${hitLoc}".`)
      : jobLocation.trim() || /remote|hybrid|on-?site|office|[A-Z][a-z]+, [A-Z][A-Za-z]+/.test(jd)
        ? dim(3, 'Location does not match your preferences.')
        : dim(5, 'Location not stated.')

  const priorityWords = profile.priorities.toLowerCase().split(/[^a-z0-9+#]+/).filter(w => w.length > 3)
  const goalHits = priorityWords.filter(w => jdLower.includes(w))
  const goals = !priorityWords.length
    ? dim(5, 'No career priorities set.')
    : dim(3 + (goalHits.length / priorityWords.length) * 6, goalHits.length ? `Mentions ${goalHits.slice(0, 3).join(', ')}.` : 'None of your priorities are mentioned.')

  const dealBreakersHit = profile.dealBreakers
    .filter(d => d && jdLower.includes(d.toLowerCase()))
    .map(d => ({ dealBreaker: d, evidence: d }))

  return {
    dimensions: {
      skills: dim(coverage * 10, `${matchedKeywords.length} of ${required} detected skills are on the resume.`),
      experience: dim(4 + coverage * 5, 'Estimated from skill overlap (demo mode).'),
      seniority,
      location,
      goals,
    },
    dealBreakersHit,
    oneLine: `[Demo] ${coverage >= 0.7 ? 'Strong' : coverage >= 0.4 ? 'Partial' : 'Weak'} skills overlap${dealBreakersHit.length ? '; a deal-breaker is triggered' : ''}.`,
  }
}

export function mockDeep(jobDescription: string, resumeText: string, profile: FitProfile, title = '', jobLocation = ''): DeepAnalysisOutput {
  const rubric = mockRubric(jobDescription, resumeText, profile, title, jobLocation)
  const a = mockAnalyze(jobDescription, resumeText)
  return {
    ...rubric,
    matchedKeywords: a.matchedKeywords,
    missingKeywords: a.missingKeywords,
    summary: a.summary,
    improvedSummary: a.improvedSummary,
    suggestions: a.suggestions,
  }
}

export function mockCoverLetter(jobTitle: string, company: string, jobDescription: string, resumeText: string): string {
  const { matchedKeywords } = mockAnalyze(jobDescription, resumeText)
  const skills = matchedKeywords.slice(0, 3).join(', ') || 'data analysis'
  const role = jobTitle || 'this role'
  const org = company || 'your team'
  return [
    `I am excited to apply for the ${role} position at ${org}. The posting's focus on ${skills} lines up closely with the work I have been doing, and I would welcome the chance to bring that experience to ${org}.`,
    `In my recent roles I have used ${skills} to answer real business questions end to end, from framing the problem and preparing the data to communicating results to stakeholders who act on them.`,
    `I would be glad to discuss how I could contribute to ${org}. Thank you for your time and consideration.`,
    '',
    'Demo mode: this letter comes from a template. Add an API key to have Claude draft it and a second pass review it.',
  ].join('\n\n')
}
