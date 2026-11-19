import { NextRequest, NextResponse } from 'next/server'
import { readResumes, saveResume, getDefaultPersonaId } from '@/lib/storage'
import type { ResumeEntry } from '@/lib/storage'
import { v4 as uuidv4 } from 'uuid'

function pid(req: NextRequest) {
  return req.headers.get('x-persona-id') || getDefaultPersonaId()
}

// Legacy compat: GET returns first resume text
export async function GET(req: NextRequest) {
  const resumes = readResumes(pid(req))
  const first = resumes[0]
  return NextResponse.json({ baseResume: first?.text || '', updatedAt: first?.updatedAt || '' })
}

// Legacy compat: POST upserts the first resume
export async function POST(req: NextRequest) {
  const personaId = pid(req)
  const { resume } = await req.json()
  if (!resume) return NextResponse.json({ error: 'Resume text required' }, { status: 400 })
  const resumes = readResumes(personaId)
  if (resumes.length > 0) {
    resumes[0] = { ...resumes[0], text: resume, updatedAt: new Date().toISOString() }
    saveResume(personaId, resumes[0])
  } else {
    const entry: ResumeEntry = {
      id: uuidv4(), name: 'My Resume',
      text: resume, updatedAt: new Date().toISOString(),
    }
    saveResume(personaId, entry)
  }
  return NextResponse.json({ ok: true })
}
