import { NextRequest, NextResponse } from 'next/server'
import { readJobs, saveJob, deleteJob, getDefaultPersonaId, readSettings } from '@/lib/storage'
import type { Job } from '@/lib/storage'
import { v4 as uuidv4 } from 'uuid'
import { cleanJobFields, findDuplicate, validateJob } from '@/lib/jobs'

const today = () => new Date().toISOString().slice(0, 10)

function pid(req: NextRequest) {
  return req.headers.get('x-persona-id') || getDefaultPersonaId()
}

export async function GET(req: NextRequest) {
  return NextResponse.json(readJobs(pid(req)))
}

export async function POST(req: NextRequest) {
  const personaId = pid(req)
  const body = cleanJobFields(await req.json())
  const settings = readSettings()
  const checklistTemplate = settings.checklistTemplate || []

  const errors = validateJob(body)
  if (errors.length) return NextResponse.json({ error: `Invalid job: ${errors.join(', ')}` }, { status: 400 })

  const duplicate = findDuplicate({ title: body.title!, company: body.company!, url: body.url || '' }, readJobs(personaId))
  if (duplicate) {
    return NextResponse.json(
      { error: `Already tracked: "${duplicate.title}" at ${duplicate.company} (status: ${duplicate.status})`, duplicateId: duplicate.id },
      { status: 409 },
    )
  }

  const status = body.status || 'saved'
  const job: Job = {
    id: uuidv4(),
    title: body.title || '',
    company: body.company || '',
    location: body.location || '',
    url: body.url || '',
    description: body.description || '',
    status,
    notes: body.notes || '',
    appliedDate: body.appliedDate || (status !== 'saved' ? today() : ''),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    regionId: body.regionId,
    roleId: body.roleId,
    checklist: checklistTemplate.map(t => ({ id: t.id, item: t.item, done: false })),
  }
  saveJob(personaId, job)
  return NextResponse.json(job)
}

export async function PUT(req: NextRequest) {
  const personaId = pid(req)
  const body = await req.json()
  const existing = readJobs(personaId).find(j => j.id === body.id)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const updated: Job = { ...existing, ...body, updatedAt: new Date().toISOString() }
  // Record when a job first leaves "saved", so the pipeline has real application dates
  if (existing.status === 'saved' && updated.status !== 'saved' && !updated.appliedDate) {
    updated.appliedDate = today()
  }
  saveJob(personaId, updated)
  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  deleteJob(pid(req), id)
  return NextResponse.json({ ok: true })
}
