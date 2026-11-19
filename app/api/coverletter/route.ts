import { NextRequest, NextResponse } from 'next/server'
import { getBestResume, getDefaultPersonaId, readJobs, readResumes } from '@/lib/storage'
import { researchBrief } from '@/lib/research'
import { generateCoverLetter } from '@/lib/coverletter'

export async function POST(req: NextRequest) {
  const personaId = req.headers.get('x-persona-id') || getDefaultPersonaId()
  const { jobTitle, company, jobDescription, tone, resumeId, regionId, roleId, jobId } = await req.json()
  const job = jobId ? readJobs(personaId).find(j => j.id === jobId) : undefined
  // Saved company research (if any) gives the drafter real facts and the reviewer something to check them against.
  const research = job?.research && job.research.company === company ? researchBrief(job.research) : undefined

  const resumeText =
    (resumeId ? readResumes(personaId).find(r => r.id === resumeId)?.text : '') ||
    getBestResume(personaId, regionId, roleId)?.text ||
    ''

  if (!resumeText) return NextResponse.json({ error: 'No resume found. Please add a resume in the Resume tab.' }, { status: 400 })
  if (!jobTitle || !company) return NextResponse.json({ error: 'Job title and company are required.' }, { status: 400 })

  try {
    const result = await generateCoverLetter({ jobTitle, company, jobDescription: jobDescription || '', resumeText, tone, research })
    return NextResponse.json(result)
  } catch (err: any) {
    console.error('Cover letter error:', err.message)
    return NextResponse.json({ error: 'Cover letter failed: ' + err.message }, { status: 502 })
  }
}
