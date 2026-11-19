import { NextRequest, NextResponse } from 'next/server'
import { getDefaultPersonaId, readJobs, readRoles, updateLearningFromJob, writeJobs, writeLearning } from '@/lib/storage'
import { assignRole } from '@/lib/roles'

function pid(req: NextRequest) {
  return req.headers.get('x-persona-id') || getDefaultPersonaId()
}

/** Proposed role for every job that has none yet. */
function proposals(personaId: string) {
  const roles = readRoles(personaId)
  const jobs = readJobs(personaId)
  const changes = new Map<string, string>()
  for (const j of jobs) {
    if (j.roleId && roles.some(r => r.id === j.roleId)) continue
    const roleId = assignRole(j, roles)
    if (roleId) changes.set(j.id, roleId)
  }
  return { roles, jobs, changes }
}

// GET: how many untagged jobs would get a role (dry run)
export async function GET(req: NextRequest) {
  const { jobs, roles, changes } = proposals(pid(req))
  const byRole: Record<string, number> = {}
  for (const roleId of Array.from(changes.values())) {
    const name = roles.find(r => r.id === roleId)!.name
    byRole[name] = (byRole[name] || 0) + 1
  }
  const untagged = jobs.filter(j => !j.roleId || !roles.some(r => r.id === j.roleId)).length
  return NextResponse.json({ untagged, assignable: changes.size, byRole })
}

// POST: tag untagged jobs with their best-matching role. Existing tags are never changed.
export async function POST(req: NextRequest) {
  const personaId = pid(req)
  const { jobs, roles, changes } = proposals(personaId)
  if (!changes.size) return NextResponse.json({ assigned: 0 })
  const now = new Date().toISOString()
  const updated = jobs.map(j => {
    const roleId = changes.get(j.id)
    if (!roleId) return j
    const role = roles.find(r => r.id === roleId)
    return { ...j, roleId, regionId: j.regionId || role?.regionId, updatedAt: now }
  })
  writeJobs(personaId, updated)
  // The Learning Radar groups gaps by role, so rebuild it
  writeLearning(personaId, [])
  for (const job of updated.filter(j => j.atsAnalysis)) updateLearningFromJob(personaId, job)
  return NextResponse.json({ assigned: changes.size })
}
