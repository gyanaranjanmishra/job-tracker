import { NextRequest, NextResponse } from 'next/server'
import { readRegions, writeRegions, getDefaultPersonaId, makeDefaultRegions } from '@/lib/storage'
import type { RegionConfig, BoardEntry } from '@/lib/storage'
import { v4 as uuidv4 } from 'uuid'

function pid(req: NextRequest) {
  return req.headers.get('x-persona-id') || getDefaultPersonaId()
}

export async function GET(req: NextRequest) {
  return NextResponse.json(readRegions(pid(req)))
}

export async function POST(req: NextRequest) {
  const personaId = pid(req)
  const body = await req.json()

  if (body.action === 'add_region') {
    const regions = readRegions(personaId)
    const region: RegionConfig = { id: uuidv4(), name: body.name, boards: [] }
    regions.push(region)
    writeRegions(personaId, regions)
    return NextResponse.json(region)
  }

  if (body.action === 'add_board') {
    const regions = readRegions(personaId)
    const region = regions.find(r => r.id === body.regionId)
    if (!region) return NextResponse.json({ error: 'Region not found' }, { status: 404 })
    const board: BoardEntry = { id: uuidv4(), name: body.name, url: body.url || '', enabled: true }
    region.boards.push(board)
    writeRegions(personaId, regions)
    return NextResponse.json(board)
  }

  if (body.action === 'reset') {
    const regions = makeDefaultRegions()
    writeRegions(personaId, regions)
    return NextResponse.json(regions)
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

export async function PUT(req: NextRequest) {
  const personaId = pid(req)
  const body = await req.json()
  const regions = readRegions(personaId)

  if (body.action === 'update_region') {
    const r = regions.find(r => r.id === body.regionId)
    if (r && body.name) r.name = body.name
    writeRegions(personaId, regions)
    return NextResponse.json({ ok: true })
  }

  if (body.action === 'toggle_board') {
    for (const r of regions) {
      const b = r.boards.find(b => b.id === body.boardId)
      if (b) { b.enabled = !b.enabled; break }
    }
    writeRegions(personaId, regions)
    return NextResponse.json({ ok: true })
  }

  if (body.action === 'update_board') {
    for (const r of regions) {
      const b = r.boards.find(b => b.id === body.boardId)
      if (b) {
        if (body.name !== undefined) b.name = body.name
        if (body.url !== undefined) b.url = body.url
        break
      }
    }
    writeRegions(personaId, regions)
    return NextResponse.json({ ok: true })
  }

  // Full replace
  if (Array.isArray(body)) {
    writeRegions(personaId, body)
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

export async function DELETE(req: NextRequest) {
  const personaId = pid(req)
  const { searchParams } = new URL(req.url)
  const regionId = searchParams.get('regionId')
  const boardId = searchParams.get('boardId')
  const regions = readRegions(personaId)

  if (boardId) {
    for (const r of regions) {
      r.boards = r.boards.filter(b => b.id !== boardId)
    }
    writeRegions(personaId, regions)
    return NextResponse.json({ ok: true })
  }

  if (regionId) {
    writeRegions(personaId, regions.filter(r => r.id !== regionId))
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Missing regionId or boardId' }, { status: 400 })
}
