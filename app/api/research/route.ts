import { NextRequest, NextResponse } from 'next/server'
import { getBestResume, getDefaultPersonaId, readJobs, readProfile, saveJob } from '@/lib/storage'
import { researchCompany } from '@/lib/research'

// Web research can take a minute (several searches plus a review call).
export const maxDuration = 120

// POST /api/research  { jobId }
// Researches the job's employer on the web and saves a fit review on the job.
// One job per request on purpose: the user picks which jobs are worth the searches.
export async function POST(req: NextRequest) {
  const personaId = req.headers.get('x-persona-id') || getDefaultPersonaId()
  const body = await req.json().catch(() => ({}))
  const job = readJobs(personaId).find(j => j.id === body.jobId)
  if (!job) return NextResponse.json({ error: 'Job not found.' }, { status: 404 })
  if (!job.company.trim()) return NextResponse.json({ error: 'This job has no company name to research.' }, { status: 400 })

  const resumeText = getBestResume(personaId, job.regionId, job.roleId)?.text || ''
  if (!resumeText) return NextResponse.json({ error: 'No resume found. Please add a resume in the Resume tab.' }, { status: 400 })

  try {
    const research = await researchCompany({
      company: job.company,
      title: job.title,
      location: job.location,
      jobDescription: job.description || '',
      resumeText,
      profile: readProfile(personaId),
    })
    job.research = research
    job.updatedAt = new Date().toISOString()
    saveJob(personaId, job)
    return NextResponse.json({ research })
  } catch (err: any) {
    console.error('Research error:', err.message)
    return NextResponse.json({ error: 'Research failed: ' + err.message }, { status: 502 })
  }
}
