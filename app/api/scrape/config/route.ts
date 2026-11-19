import { NextRequest, NextResponse } from 'next/server'
import { readScraperConfig, writeScraperConfig, getDefaultPersonaId } from '@/lib/storage'
import type { ScraperConfig } from '@/lib/storage'

function pid(req: NextRequest) {
  return req.headers.get('x-persona-id') || getDefaultPersonaId()
}

export async function GET(req: NextRequest) {
  return NextResponse.json(readScraperConfig(pid(req)))
}

export async function POST(req: NextRequest) {
  try {
    const config: ScraperConfig = await req.json()
    writeScraperConfig(pid(req), config)
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
