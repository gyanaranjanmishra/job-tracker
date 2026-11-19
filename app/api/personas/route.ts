import { NextRequest, NextResponse } from 'next/server'
import { readSettings, writeSettings, addPersona, deletePersona } from '@/lib/storage'
import { DEMO_MODE } from '@/lib/demo'

export async function GET() {
  const settings = readSettings()
  return NextResponse.json({ personas: settings.personas, checklistTemplate: settings.checklistTemplate, demo: DEMO_MODE })
}

export async function POST(req: NextRequest) {
  const { name } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })
  const persona = addPersona(name.trim())
  return NextResponse.json(persona)
}

export async function PUT(req: NextRequest) {
  const body = await req.json()
  const settings = readSettings()
  if (body.checklistTemplate !== undefined) {
    settings.checklistTemplate = body.checklistTemplate
    writeSettings(settings)
    return NextResponse.json({ ok: true })
  }
  if (body.personaId && body.name) {
    const p = settings.personas.find(p => p.id === body.personaId)
    if (p) { p.name = body.name; writeSettings(settings) }
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const personaId = searchParams.get('personaId')
  if (!personaId) return NextResponse.json({ error: 'Missing personaId' }, { status: 400 })
  const settings = readSettings()
  if (settings.personas.length <= 1) return NextResponse.json({ error: 'Cannot delete the only persona' }, { status: 400 })
  deletePersona(personaId)
  return NextResponse.json({ ok: true })
}
