import { NextRequest, NextResponse } from 'next/server'
import { readJobs, saveJob, deleteJob, getDefaultPersonaId, readSettings } from '@/lib/storage'
import type { Job } from '@/lib/storage'
import { v4 as uuidv4 } from 'uuid'

function pid(req: NextRequest) {
  return req.headers.get('x-persona-id') || getDefaultPersonaId()
}

export async function GET(req: NextRequest) {
  return NextResponse.json(readJobs(pid(req)))
}

export async function POST(req: NextRequest) {
  const personaId = pid(req)
  const body = await req.json()
  const settings = readSettings()
  const checklistTemplate = settings.checklistTemplate || []

  const job: Job = {
    id: uuidv4(),
    title: body.title || '',
    company: body.company || '',
    location: body.location || '',
    url: body.url || '',
    description: body.description || '',
    status: body.status || 'saved',
    notes: body.notes || '',
    appliedDate: body.appliedDate || '',
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
