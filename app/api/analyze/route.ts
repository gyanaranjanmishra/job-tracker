import { NextRequest, NextResponse } from 'next/server'
import {
  getBestResume, getDefaultPersonaId, readJobs, readProfile, readResumes, updateJob, updateLearningFromJob, type Job,
} from '@/lib/storage'
import { deepAnalyzeJob, triageJob, type DeepResult, type TriageResult } from '@/lib/analysis'

// POST /api/analyze
//   mode: 'triage' (rubric score only, cheap) | 'deep' (rubric + ATS review). Default 'deep'.
//   jobId: optional; when given, the result is saved on that job.
export async function POST(req: NextRequest) {
  const personaId = req.headers.get('x-persona-id') || getDefaultPersonaId()
  const body = await req.json()
  const mode: 'triage' | 'deep' = body.mode === 'triage' ? 'triage' : 'deep'

  const job = body.jobId ? readJobs(personaId).find(j => j.id === body.jobId) : undefined
  const jobDescription: string = body.jobDescription || job?.description || ''
  const regionId = body.regionId || job?.regionId
  const roleId = body.roleId || job?.roleId

  // Resume: explicit override > explicit resumeId > best match by region/role > first resume
  const resumeText: string =
    body.resumeOverride ||
    (body.resumeId ? readResumes(personaId).find(r => r.id === body.resumeId)?.text : '') ||
    getBestResume(personaId, regionId, roleId)?.text ||
    ''

  if (!resumeText) return NextResponse.json({ error: 'No resume found. Please add a resume in the Resume tab.' }, { status: 400 })
  if (!jobDescription.trim()) return NextResponse.json({ error: 'Job description is required.' }, { status: 400 })

  const input = {
    jobDescription,
    resumeText,
    profile: readProfile(personaId),
    title: body.title || job?.title,
    company: body.company || job?.company,
    location: job?.location,
  }

  try {
    const deep: DeepResult | null = mode === 'deep' ? await deepAnalyzeJob(input) : null
    const result: TriageResult = deep ?? await triageJob(input)

    if (job) {
      const patch: Partial<Job> = { fitScore: result.fitScore, rubric: result.rubric, postingFlags: result.postingFlags }
      if (deep) {
        patch.keywords = deep.matchedKeywords
        patch.atsAnalysis = {
          summary: deep.summary,
          matchedKeywords: deep.matchedKeywords,
          missingKeywords: deep.missingKeywords,
          improvedSummary: deep.improvedSummary,
          suggestions: deep.suggestions,
          analyzedAt: new Date().toISOString(),
        }
      }
      // Merge into the job as it is now; the AI call may have taken a while.
      const saved = updateJob(personaId, job.id, patch)
      if (saved?.atsAnalysis) updateLearningFromJob(personaId, saved)
    }

    return NextResponse.json({ mode, ...result })
  } catch (err: any) {
    console.error(`Analysis (${mode}) error:`, err.message)
    return NextResponse.json({ error: 'Analysis failed: ' + err.message }, { status: 502 })
  }
}
