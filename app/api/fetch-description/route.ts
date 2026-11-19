import { NextResponse } from 'next/server'
import { load } from 'cheerio'

// Selectors tried in order — covers Greenhouse, Lever, and generic job pages
const DESCRIPTION_SELECTORS = [
  '#content',                        // Greenhouse
  '.content',                        // Greenhouse alt
  '[class*="posting-description"]',  // Lever
  '[class*="job-description"]',
  '[class*="jobDescription"]',
  '[class*="job_description"]',
  '[class*="description-content"]',
  '[class*="job-details"]',
  '[class*="jobDetails"]',
  'article',
  '[class*="vacancy"]',
  '[class*="position-description"]',
  'main',
]

function extractDescription(html: string): string {
  const $ = load(html)

  // Remove noise
  $('script, style, nav, header, footer, [class*="apply"], [class*="sidebar"], [class*="similar"]').remove()

  for (const sel of DESCRIPTION_SELECTORS) {
    const el = $(sel).first()
    if (el.length) {
      const text = el.text().replace(/\s{2,}/g, '\n').trim()
      if (text.length > 200) return text
    }
  }

  // Last resort: body text
  return $('body').text().replace(/\s{2,}/g, '\n').trim().slice(0, 5000)
}

export async function POST(req: Request) {
  try {
    const { url } = await req.json()
    if (!url) return NextResponse.json({ error: 'URL required' }, { status: 400 })

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-CA,en;q=0.9',
      },
      redirect: 'follow',
    })

    if (!res.ok) {
      return NextResponse.json({ error: `Failed to fetch page (${res.status})` }, { status: 502 })
    }

    const html = await res.text()
    const description = extractDescription(html)

    if (!description || description.length < 50) {
      return NextResponse.json({ error: 'Could not extract description from this page' }, { status: 422 })
    }

    return NextResponse.json({ description })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
