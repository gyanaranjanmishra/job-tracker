import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getBestResume, getDefaultPersonaId, updateLearningFromJob, getJob } from '@/lib/storage'
import { DEMO_MODE, mockAnalyze } from '@/lib/demo'

export async function POST(req: NextRequest) {
  const personaId = req.headers.get('x-persona-id') || getDefaultPersonaId()
  const { jobDescription, resumeOverride, resumeId, regionId, roleId, jobId } = await req.json()

  // Resolve resume: explicit override > explicit resumeId > best match by region/role > first resume
  let resumeText = resumeOverride || ''
  if (!resumeText) {
    const entry = resumeId
      ? null // handled below
      : getBestResume(personaId, regionId, roleId)
    if (resumeId) {
      const { readResumes } = await import('@/lib/storage')
      const resumes = readResumes(personaId)
      const r = resumes.find(r => r.id === resumeId)
      resumeText = r?.text || ''
    } else {
      resumeText = entry?.text || ''
    }
  }

  if (!resumeText) return NextResponse.json({ error: 'No resume found. Please add a resume in the Resume tab.' }, { status: 400 })
  if (!jobDescription) return NextResponse.json({ error: 'Job description is required.' }, { status: 400 })

  const prompt = `You are an expert ATS resume optimizer.

JOB DESCRIPTION:
${jobDescription}

CANDIDATE RESUME:
${resumeText}

Return ONLY a valid JSON object with exactly these fields, no markdown, no backticks, no explanation:
{
  "fitScore": <number 0-100>,
  "matchedKeywords": ["keyword1", "keyword2"],
  "missingKeywords": ["keyword1", "keyword2"],
  "summary": "<2-3 sentence assessment>",
  "improvedSummary": "<rewritten professional summary>",
  "suggestions": [
    { "section": "<name>", "original": "<original or empty>", "improved": "<improved version>" }
  ]
}

IMPORTANT: Use only plain ASCII double quotes. No special characters in keys. Valid JSON only.`

  try {
    let raw: string
    if (DEMO_MODE) {
      raw = JSON.stringify(mockAnalyze(jobDescription, resumeText))
    } else {
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      const message = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2500,
        messages: [{ role: 'user', content: prompt }],
      })
      raw = message.content[0].type === 'text' ? message.content[0].text : ''
    }
    let cleaned = raw.replace(/```json/g, '').replace(/```/g, '').trim()
    // Strip control characters that break JSON parsing
    cleaned = cleaned.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, ' ')
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start === -1 || end === -1) throw new Error('No JSON found in response')

    let jsonStr = cleaned.slice(start, end + 1)
    let result: any
    try {
      result = JSON.parse(jsonStr)
    } catch {
      // Response was truncated mid-array — drop the last incomplete element and close the object
      const lastComma = jsonStr.lastIndexOf(',')
      if (lastComma !== -1) {
        jsonStr = jsonStr.slice(0, lastComma) + '}'
        result = JSON.parse(jsonStr)
      } else {
        throw new Error('Unparseable JSON from model: ' + (raw.slice(0, 200)))
      }
    }

    // Ensure all required fields always exist with safe defaults
    result.fitScore = typeof result.fitScore === 'number' ? result.fitScore : 0
    result.matchedKeywords = Array.isArray(result.matchedKeywords) ? result.matchedKeywords : []
    result.missingKeywords = Array.isArray(result.missingKeywords) ? result.missingKeywords : []
    result.summary = result.summary || ''
    result.improvedSummary = result.improvedSummary || ''
    result.suggestions = Array.isArray(result.suggestions) ? result.suggestions : []

    // Update learning data if we have a jobId
    if (jobId) {
      const { saveJob, readJobs } = await import('@/lib/storage')
      const jobs = readJobs(personaId)
      const job = jobs.find(j => j.id === jobId)
      if (job) {
        job.atsAnalysis = {
          summary: result.summary,
          matchedKeywords: result.matchedKeywords,
          missingKeywords: result.missingKeywords,
          improvedSummary: result.improvedSummary,
          suggestions: result.suggestions,
          analyzedAt: new Date().toISOString(),
        }
        job.fitScore = result.fitScore
        job.keywords = result.matchedKeywords
        saveJob(personaId, job)
        updateLearningFromJob(personaId, job)
      }
    }

    return NextResponse.json(result)
  } catch (err: any) {
    console.error('Analysis error:', err.message)
    return NextResponse.json({ error: 'Analysis failed: ' + err.message }, { status: 500 })
  }
}
