// Builds real PDF and DOCX files in memory, so no binary fixtures live in the repo.
import JSZip from 'jszip'
import PDFDocument from 'pdfkit'
import { describe, expect, it } from 'vitest'
import { parseResumeFile, ResumeParseError, tidyText } from '@/lib/resumeParse'

const LINES = [
  'Alex Morgan',
  'Materials Engineer',
  'Experience: failure analysis, heat treatment, SEM and EDS characterisation of steel and aluminium alloys.',
  'Education: PhD, Materials Science and Engineering.',
]
const filler = 'Led corrosion testing and metallographic preparation for automotive and aerospace components. '.repeat(3)

function makePdf(lines: string[]): Promise<Uint8Array> {
  return new Promise(resolve => {
    const doc = new PDFDocument()
    const chunks: Buffer[] = []
    doc.on('data', (c: Buffer) => chunks.push(c))
    doc.on('end', () => resolve(new Uint8Array(Buffer.concat(chunks))))
    lines.forEach((l, i) => {
      if (i === 3) doc.addPage()
      doc.text(l)
    })
    doc.end()
  })
}

async function makeDocx(paragraphs: string[]): Promise<Uint8Array> {
  const zip = new JSZip()
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`)
  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`)
  const body = paragraphs.map(p => `<w:p><w:r><w:t xml:space="preserve">${p}</w:t></w:r></w:p>`).join('')
  zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`)
  return zip.generateAsync({ type: 'uint8array' })
}

const enc = (s: string) => new TextEncoder().encode(s)

describe('parseResumeFile', () => {
  it('extracts text from a multi-page PDF', async () => {
    const r = await parseResumeFile(await makePdf([...LINES, filler]), 'Alex_Morgan-Resume.pdf')
    expect(r.format).toBe('pdf')
    expect(r.pages).toBe(2)
    expect(r.name).toBe('Alex Morgan Resume')
    for (const l of LINES) expect(r.text.replace(/\s+/g, ' ')).toContain(l)
    expect(r.warnings.some(w => /columns or tables/.test(w))).toBe(true)
  })

  it('extracts paragraphs from a .docx', async () => {
    const r = await parseResumeFile(await makeDocx([...LINES, filler]), 'cv.docx')
    expect(r.format).toBe('docx')
    expect(r.text.split('\n\n').slice(0, 4)).toEqual(LINES)
    expect(r.warnings).toEqual([])
  })

  it('reads plain text and tidies whitespace', async () => {
    const r = await parseResumeFile(enc(`${LINES.join('\r\n\r\n\r\n\r\n')}\t \n${filler}`), 'resume.txt')
    expect(r.format).toBe('text')
    expect(r.text.startsWith('Alex Morgan\n\nMaterials Engineer')).toBe(true)
  })

  it('warns when almost no text is found', async () => {
    const r = await parseResumeFile(await makePdf(['Scanned page']), 'scan.pdf')
    expect(r.warnings[0]).toMatch(/scanned PDF/)
  })

  it('rejects unsupported, empty, oversized and corrupt files with a clear message', async () => {
    await expect(parseResumeFile(enc('x'), 'resume.doc')).rejects.toThrow(/\.doc files are not supported/)
    await expect(parseResumeFile(enc('x'), 'photo.png')).rejects.toThrow(/Unsupported file type/)
    await expect(parseResumeFile(new Uint8Array(0), 'a.pdf')).rejects.toThrow(/empty/)
    await expect(parseResumeFile(new Uint8Array(6 * 1024 * 1024), 'a.txt')).rejects.toThrow(/5 MB/)
    await expect(parseResumeFile(enc('not a pdf'), 'a.pdf')).rejects.toBeInstanceOf(ResumeParseError)
    await expect(parseResumeFile(enc('not a zip'), 'a.docx')).rejects.toBeInstanceOf(ResumeParseError)
  })
})

describe('tidyText', () => {
  it('normalises line endings, spaces and blank lines', () => {
    expect(tidyText('a  b\r\n\r\n\r\n\r\nc \t d\n')).toBe('a b\n\nc d')
  })
})
