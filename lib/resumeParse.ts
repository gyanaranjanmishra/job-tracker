// Extract plain text from an uploaded resume file (PDF, Word .docx, or text).
// Runs on the server; the file itself is not stored, only the text the user saves.

import mammoth from 'mammoth'
import { extractText, getDocumentProxy } from 'unpdf'

export const MAX_RESUME_BYTES = 5 * 1024 * 1024
export const RESUME_EXTENSIONS = ['.pdf', '.docx', '.txt', '.md']

export interface ParsedResume {
  text: string
  name: string
  format: 'pdf' | 'docx' | 'text'
  pages?: number
  warnings: string[]
}

export class ResumeParseError extends Error {}

/** Tidy extracted text: normalise line endings and spaces, drop runs of blank lines. */
export function tidyText(raw: string): string {
  return raw
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t ]+/g, ' ')
    .split('\n').map(l => l.trim()).join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function extensionOf(filename: string): string {
  const m = filename.toLowerCase().match(/\.[a-z0-9]+$/)
  return m ? m[0] : ''
}

export async function parseResumeFile(data: Uint8Array, filename: string): Promise<ParsedResume> {
  const ext = extensionOf(filename)
  const name = filename.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'Resume'
  const warnings: string[] = []

  if (data.byteLength === 0) throw new ResumeParseError('The file is empty.')
  if (data.byteLength > MAX_RESUME_BYTES) throw new ResumeParseError('The file is larger than 5 MB.')

  let text: string
  let format: ParsedResume['format']
  let pages: number | undefined

  if (ext === '.pdf') {
    format = 'pdf'
    try {
      const pdf = await getDocumentProxy(new Uint8Array(data))
      const result = await extractText(pdf, { mergePages: false })
      pages = result.totalPages
      text = result.text.join('\n\n')
    } catch (e: any) {
      throw new ResumeParseError(`Could not read the PDF${/password/i.test(e?.message || '') ? ' (it is password protected)' : ''}.`)
    }
  } else if (ext === '.docx') {
    format = 'docx'
    try {
      const result = await mammoth.extractRawText({ buffer: Buffer.from(data) })
      text = result.value
    } catch {
      throw new ResumeParseError('Could not read the Word file. Save it as .docx or PDF and try again.')
    }
  } else if (ext === '.txt' || ext === '.md') {
    format = 'text'
    text = new TextDecoder('utf-8').decode(data)
  } else if (ext === '.doc') {
    throw new ResumeParseError('Old .doc files are not supported. Save it as .docx or PDF and try again.')
  } else {
    throw new ResumeParseError(`Unsupported file type. Use ${RESUME_EXTENSIONS.join(', ')}.`)
  }

  text = tidyText(text)
  const words = text.split(/\s+/).filter(Boolean).length
  if (words < 30) {
    warnings.push(format === 'pdf'
      ? 'Very little text was found. If this is a scanned PDF, export it from your editor as a text-based PDF or .docx.'
      : 'Very little text was found in this file.')
  }
  if (format === 'pdf') warnings.push('Check the extracted text: PDF layouts with columns or tables can come out in an unexpected order.')

  return { text, name, format, pages, warnings }
}
