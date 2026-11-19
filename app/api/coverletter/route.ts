import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getBestResume, getDefaultPersonaId } from '@/lib/storage'
import { DEMO_MODE, mockCoverLetter } from '@/lib/demo'

export async function POST(req: NextRequest) {
  const personaId = req.headers.get('x-persona-id') || getDefaultPersonaId()
  const { jobTitle, company, jobDescription, tone, resumeId, regionId, roleId } = await req.json()

  let resumeText = ''
  if (resumeId) {
    const { readResumes } = await import('@/lib/storage')
    const resumes = readResumes(personaId)
    resumeText = resumes.find(r => r.id === resumeId)?.text || ''
  }
  if (!resumeText) {
    const entry = getBestResume(personaId, regionId, roleId)
    resumeText = entry?.text || ''
  }

  if (!resumeText) return NextResponse.json({ error: 'No resume found. Please add a resume in the Resume tab.' }, { status: 400 })

  if (DEMO_MODE) {
    return NextResponse.json({ coverLetter: mockCoverLetter(jobTitle, company, jobDescription || '', resumeText) })
  }
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const prompt = `Write a compelling cover letter for this job application.

Role: ${jobTitle} at ${company}
Tone: ${tone || 'professional but personable'}

JOB DESCRIPTION:
${jobDescription}

CANDIDATE RESUME:
${resumeText}

Write a 3-paragraph cover letter (opening hook, relevant experience match, closing with call to action).
Do not use generic filler phrases. Be specific to the role and company.
Output only the cover letter text — no subject line, no "Dear Hiring Manager" header needed.`

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 800,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  return NextResponse.json({ coverLetter: text })
}
