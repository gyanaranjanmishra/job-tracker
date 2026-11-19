import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { readJobs, writeJobs, personaDir, getDefaultPersonaId, writeLearning, updateLearningFromJob } from '@/lib/storage'
import { cleanJobFields, dedupExisting } from '@/lib/jobs'

function pid(req: NextRequest) {
  return req.headers.get('x-persona-id') || getDefaultPersonaId()
}

// GET: how many duplicates would be merged (dry run)
export async function GET(req: NextRequest) {
  const jobs = readJobs(pid(req)).map(cleanJobFields)
  const { removed, groups } = dedupExisting(jobs)
  return NextResponse.json({ duplicates: removed, groups: groups.length })
}

// POST: back up jobs.json, clean fields, merge duplicates, rebuild learning data
export async function POST(req: NextRequest) {
  const personaId = pid(req)
  const dir = personaDir(personaId)
  const original = readJobs(personaId)

  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backup = path.join(dir, `jobs.backup-${stamp}.json`)
  fs.writeFileSync(backup, JSON.stringify(original, null, 2))

  const cleaned = original.map(cleanJobFields)
  const fieldsFixed = cleaned.filter((j, i) => j.company !== original[i].company || j.title !== original[i].title).length
  const { jobs, removed, groups } = dedupExisting(cleaned)
  writeJobs(personaId, jobs)

  // Learning data references job IDs, some of which no longer exist
  writeLearning(personaId, [])
  for (const job of jobs.filter(j => j.atsAnalysis)) updateLearningFromJob(personaId, job)

  return NextResponse.json({ removed, groups: groups.length, fieldsFixed, total: jobs.length, backup: path.basename(backup) })
}
