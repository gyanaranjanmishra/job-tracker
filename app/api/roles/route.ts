import { NextRequest, NextResponse } from 'next/server'
import { readRoles, writeRoles, getDefaultPersonaId } from '@/lib/storage'
import type { RoleConfig } from '@/lib/storage'
import { v4 as uuidv4 } from 'uuid'

function pid(req: NextRequest) {
  return req.headers.get('x-persona-id') || getDefaultPersonaId()
}

export async function GET(req: NextRequest) {
  return NextResponse.json(readRoles(pid(req)))
}

export async function POST(req: NextRequest) {
  const personaId = pid(req)
  const body = await req.json()
  if (!body.name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })
  const roles = readRoles(personaId)
  const role: RoleConfig = {
    id: uuidv4(),
    name: body.name.trim(),
    resumeId: body.resumeId,
    regionId: body.regionId,
  }
  roles.push(role)
  writeRoles(personaId, roles)
  return NextResponse.json(role)
}

export async function PUT(req: NextRequest) {
  const personaId = pid(req)
  const body = await req.json()
  if (!body.id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  const roles = readRoles(personaId)
  const idx = roles.findIndex(r => r.id === body.id)
  if (idx < 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  roles[idx] = { ...roles[idx], ...body }
  writeRoles(personaId, roles)
  return NextResponse.json(roles[idx])
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  const personaId = pid(req)
  writeRoles(personaId, readRoles(personaId).filter(r => r.id !== id))
  return NextResponse.json({ ok: true })
}
