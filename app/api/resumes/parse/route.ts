import { NextRequest, NextResponse } from 'next/server'
import { MAX_RESUME_BYTES, parseResumeFile, ResumeParseError } from '@/lib/resumeParse'

export const runtime = 'nodejs'

// POST /api/resumes/parse  (multipart form, field "file")
// Returns the extracted text for the user to review; nothing is saved here.
export async function POST(req: NextRequest) {
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Expected a file upload.' }, { status: 400 })
  }
  const file = form.get('file')
  if (!file || typeof file === 'string') return NextResponse.json({ error: 'No file received.' }, { status: 400 })
  if (file.size > MAX_RESUME_BYTES) return NextResponse.json({ error: 'The file is larger than 5 MB.' }, { status: 413 })

  try {
    const parsed = await parseResumeFile(new Uint8Array(await file.arrayBuffer()), file.name)
    return NextResponse.json(parsed)
  } catch (e: any) {
    if (e instanceof ResumeParseError) return NextResponse.json({ error: e.message }, { status: 422 })
    console.error('Resume parse error:', e?.message)
    return NextResponse.json({ error: 'Could not read that file.' }, { status: 500 })
  }
}
