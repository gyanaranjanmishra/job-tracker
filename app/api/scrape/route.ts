import { NextRequest, NextResponse } from 'next/server'
import { runScraper } from '@/lib/scraper'
import { getDefaultPersonaId } from '@/lib/storage'

export async function POST(req: NextRequest) {
  try {
    const personaId = req.headers.get('x-persona-id') || getDefaultPersonaId()
    const result = await runScraper(personaId)

    // Log per-source results for visibility
    for (const s of result.sources) {
      if (s.error) {
        console.error(`[Scraper] ${s.source}: ${s.error}`)
      } else {
        console.log(`[Scraper] ${s.source}: fetched ${s.fetched}`)
      }
    }

    return NextResponse.json(result)
  } catch (err: any) {
    console.error('[Scraper] Fatal error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
