import { NextRequest, NextResponse } from 'next/server'
import { readResumes, saveResume, deleteResume, getDefaultPersonaId } from '@/lib/storage'
import type { ResumeEntry } from '@/lib/storage'
import { v4 as uuidv4 } from 'uuid'

function pid(req: NextRequest) {
  return req.headers.get('x-persona-id') || getDefaultPersonaId()
}

export async function GET(req: NextRequest) {
  return NextResponse.json(readResumes(pid(req)))
}

export async function POST(req: NextRequest) {
  const personaId = pid(req)
  const body = await req.json()
  const entry: ResumeEntry = {
    id: body.id || uuidv4(),
    name: body.name || 'Resume',
    regionId: body.regionId,
    roleId: body.roleId,
    text: body.text || '',
    updatedAt: new Date().toISOString(),
  }
  saveResume(personaId, entry)
  return NextResponse.json(entry)
}

export async function PUT(req: NextRequest) {
  const personaId = pid(req)
  const body = await req.json()
  if (!body.id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  const existing = readResumes(personaId).find(r => r.id === body.id)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const updated: ResumeEntry = { ...existing, ...body, updatedAt: new Date().toISOString() }
  saveResume(personaId, updated)
  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  deleteResume(pid(req), id)
  return NextResponse.json({ ok: true })
}
