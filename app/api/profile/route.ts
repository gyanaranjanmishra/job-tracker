import { NextRequest, NextResponse } from 'next/server'
import { getDefaultPersonaId, readProfile, writeProfile } from '@/lib/storage'

function pid(req: NextRequest) {
  return req.headers.get('x-persona-id') || getDefaultPersonaId()
}

export async function GET(req: NextRequest) {
  return NextResponse.json(readProfile(pid(req)))
}

export async function PUT(req: NextRequest) {
  return NextResponse.json(writeProfile(pid(req), await req.json()))
}
