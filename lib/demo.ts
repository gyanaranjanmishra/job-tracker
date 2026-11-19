// Demo mode: lets the app run end to end with no API keys.
//
// Enabled when ANTHROPIC_API_KEY is not set, or when DEMO_MODE=true.
// In demo mode:
//   - data is read from / written to .demo-data/ (seeded from sample-data/), never data/
//   - ATS analysis and cover letters are produced locally by the functions below
//     instead of calling Claude, so results are illustrative, not real model output

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
    '[Demo cover letter generated from a template. Add an API key to generate a tailored letter with Claude.]',
  ].join('\n\n')
}
