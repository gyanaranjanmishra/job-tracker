import { NextResponse } from 'next/server'
import { readJobs, getDefaultPersonaId } from '@/lib/storage'
import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'

// ── Detect Windows Downloads folder from WSL2 ─────────
function getExportDir(): string {
  // Try via cmd.exe
  try {
    const winUser = execSync('cmd.exe /c echo %USERNAME% 2>/dev/null', { encoding: 'utf8' }).trim()
    if (winUser && winUser !== '%USERNAME%') {
      const p = `/mnt/c/Users/${winUser}/Downloads`
      if (fs.existsSync(p)) return p
    }
  } catch {}

  // Fallback: scan /mnt/c/Users/
  try {
    const systemDirs = new Set(['Public', 'Default', 'Default User', 'All Users'])
    const entries = fs.readdirSync('/mnt/c/Users').filter(d => !systemDirs.has(d) && !d.includes('.'))
    for (const user of entries) {
      const p = `/mnt/c/Users/${user}/Downloads`
      if (fs.existsSync(p)) return p
    }
  } catch {}

  // Last resort: local exports folder
  const local = path.join(process.cwd(), 'exports')
  fs.mkdirSync(local, { recursive: true })
  return local
}

function sanitizeFilename(str: string): string {
  return str.replace(/[^a-z0-9\-_]/gi, '-').replace(/-+/g, '-').slice(0, 40)
}

function wrap(text: string, maxLen: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    if ((line + ' ' + word).trim().length > maxLen) {
      if (line) lines.push(line.trim())
      line = word
    } else {
      line = (line + ' ' + word).trim()
    }
  }
  if (line) lines.push(line.trim())
  return lines
}

export async function POST(req: Request) {
  try {
    const { jobId, personaId: bodyPersonaId } = await req.json()
    const { getDefaultPersonaId } = await import('@/lib/storage')
    const personaId = (req as any).headers?.get?.('x-persona-id') || bodyPersonaId || getDefaultPersonaId()
    const jobs = readJobs(personaId)
    const job = jobs.find(j => j.id === jobId)

    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    if (!job.atsAnalysis) return NextResponse.json({ error: 'No ATS analysis found for this job. Run Top K analysis first.' }, { status: 400 })

    const analysis = job.atsAnalysis
    const exportDir = getExportDir()
    const date = new Date().toISOString().slice(0, 10)
    const filename = `job-analysis-${sanitizeFilename(job.company)}-${sanitizeFilename(job.title)}-${date}.pdf`
    const filePath = path.join(exportDir, filename)

    // ── Build PDF with pdfkit ──────────────────────────
    const PDFDocument = (await import('pdfkit')).default
    const doc = new PDFDocument({ margin: 50, size: 'A4' })
    const stream = fs.createWriteStream(filePath)
    doc.pipe(stream)

    const W = 495  // usable width
    const ACCENT = '#6c63ff'
    const MUTED = '#888888'
    const TEXT = '#1a1a1a'

    // ── Header ──
    doc.rect(0, 0, 595, 80).fill(ACCENT)
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(18)
       .text('Job Application Analysis', 50, 22)
    doc.font('Helvetica').fontSize(10)
       .text(`${job.title} · ${job.company}${job.location ? ' · ' + job.location : ''}`, 50, 48)
    doc.text(`Generated: ${new Date().toLocaleString('en-CA')}`, 50, 62)

    doc.moveDown(2)
    doc.fillColor(TEXT)

    // ── Score ──
    const scoreColor = job.fitScore !== undefined
      ? job.fitScore >= 70 ? '#27ae60' : job.fitScore >= 45 ? '#f39c12' : '#e74c3c'
      : MUTED

    doc.font('Helvetica-Bold').fontSize(13).fillColor(TEXT).text('FIT SCORE', { continued: true })
    doc.font('Helvetica-Bold').fontSize(22).fillColor(scoreColor)
       .text(`  ${job.fitScore ?? 'N/A'} / 100`)
    doc.moveDown(0.3)

    doc.font('Helvetica').fontSize(10).fillColor(MUTED).text('ASSESSMENT')
    doc.font('Helvetica').fontSize(11).fillColor(TEXT).text(analysis.summary, { lineGap: 3 })
    doc.moveDown(1)

    // ── Job Link ──
    if (job.url) {
      doc.font('Helvetica-Bold').fontSize(10).fillColor(MUTED).text('JOB POSTING')
      doc.font('Helvetica').fontSize(11).fillColor(ACCENT)
         .text(job.url, { link: job.url, underline: true })
      doc.moveDown(1)
    }

    // ── Missing Keywords ──
    doc.font('Helvetica-Bold').fontSize(10).fillColor(MUTED).text('MISSING KEYWORDS — ADD THESE TO YOUR RESUME')
    doc.moveDown(0.3)
    if (analysis.missingKeywords?.length) {
      const kwText = analysis.missingKeywords.join('  ·  ')
      doc.font('Helvetica').fontSize(11).fillColor('#e74c3c').text(kwText, { lineGap: 4 })
    } else {
      doc.font('Helvetica').fontSize(11).fillColor(MUTED).text('None — your resume already covers the key terms.')
    }
    doc.moveDown(1)

    // ── Matched Keywords ──
    doc.font('Helvetica-Bold').fontSize(10).fillColor(MUTED).text('MATCHED KEYWORDS — ALREADY IN YOUR RESUME')
    doc.moveDown(0.3)
    if (analysis.matchedKeywords?.length) {
      doc.font('Helvetica').fontSize(11).fillColor('#27ae60')
         .text(analysis.matchedKeywords.join('  ·  '), { lineGap: 4 })
    } else {
      doc.font('Helvetica').fontSize(11).fillColor(MUTED).text('None found.')
    }
    doc.moveDown(1)

    // ── Improved Summary ──
    if (analysis.improvedSummary) {
      doc.font('Helvetica-Bold').fontSize(10).fillColor(MUTED).text('REWRITTEN PROFESSIONAL SUMMARY')
      doc.rect(50, doc.y + 4, W, 1).fill('#dddddd')
      doc.moveDown(0.5)
      doc.font('Helvetica').fontSize(11).fillColor(TEXT)
         .text(analysis.improvedSummary, { lineGap: 4 })
      doc.moveDown(1)
    }

    // ── Section Suggestions ──
    if (analysis.suggestions?.length) {
      doc.font('Helvetica-Bold').fontSize(10).fillColor(MUTED).text('RESUME SECTION IMPROVEMENTS')
      doc.rect(50, doc.y + 4, W, 1).fill('#dddddd')
      doc.moveDown(0.5)

      analysis.suggestions.forEach((s, i) => {
        // Check page space
        if (doc.y > 720) doc.addPage()

        doc.font('Helvetica-Bold').fontSize(11).fillColor(ACCENT)
           .text(`${i + 1}. ${s.section?.toUpperCase() || 'SECTION'}`)
        if (s.original) {
          doc.font('Helvetica-Oblique').fontSize(10).fillColor(MUTED)
             .text('Before:  ' + s.original, { lineGap: 2 })
        }
        doc.font('Helvetica').fontSize(11).fillColor(TEXT)
           .text('After:  ' + s.improved, { lineGap: 3 })
        doc.moveDown(0.8)
      })
    }

    // ── Job Description ──
    if (job.description) {
      if (doc.y > 600) doc.addPage()
      doc.font('Helvetica-Bold').fontSize(10).fillColor(MUTED).text('JOB DESCRIPTION')
      doc.rect(50, doc.y + 4, W, 1).fill('#dddddd')
      doc.moveDown(0.5)
      const descSnippet = job.description.slice(0, 3000) + (job.description.length > 3000 ? '\n\n[... truncated — see full posting at link above]' : '')
      doc.font('Helvetica').fontSize(10).fillColor('#333333').text(descSnippet, { lineGap: 3 })
    }

    // ── Footer ──
    const range = doc.bufferedPageRange()
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i)
      doc.font('Helvetica').fontSize(9).fillColor(MUTED)
         .text(`Job Tracker — Resume Analysis · Page ${i + 1} of ${range.count}`,
           50, doc.page.height - 30, { align: 'center', width: W })
    }

    doc.end()

    await new Promise<void>((resolve, reject) => {
      stream.on('finish', resolve)
      stream.on('error', reject)
    })

    return NextResponse.json({ filename, path: filePath })
  } catch (err: any) {
    console.error('PDF export error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
