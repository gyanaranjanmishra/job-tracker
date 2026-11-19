import { NextRequest, NextResponse } from 'next/server'
import { readLearning, writeLearning, getDefaultPersonaId, readJobs, updateLearningFromJob } from '@/lib/storage'

function pid(req: NextRequest) {
  return req.headers.get('x-persona-id') || getDefaultPersonaId()
}

export async function GET(req: NextRequest) {
  const personaId = pid(req)
  const { searchParams } = new URL(req.url)
  const role = searchParams.get('role')
  const data = readLearning(personaId)
  if (role) {
    const entry = data.find(e => e.role === role)
    return NextResponse.json(entry || { role, skills: [] })
  }
  return NextResponse.json(data)
}

// POST: recompute learning from all analyzed jobs for a role (or all roles)
export async function POST(req: NextRequest) {
  const personaId = pid(req)
  const { role } = await req.json()

  // Reset learning for the role (or all)
  let learning = readLearning(personaId)
  if (role) {
    learning = learning.filter(e => e.role !== role)
  } else {
    learning = []
  }
  writeLearning(personaId, learning)

  // Re-process all analyzed jobs
  const jobs = readJobs(personaId).filter(j => j.atsAnalysis)
  for (const job of jobs) {
    updateLearningFromJob(personaId, job)
  }

  return NextResponse.json({ ok: true, processed: jobs.length })
}
