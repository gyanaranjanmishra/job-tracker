// updateJob against a throwaway persona in .demo-data (DEMO_MODE is on in tests).
import fs from 'fs'
import { afterAll, describe, expect, it } from 'vitest'
import { personaDir, readJobs, updateJob, writeJobs } from '@/lib/storage'
import { makeJob } from './helpers'

const PERSONA = `test-update-job-${process.pid}`

afterAll(() => fs.rmSync(personaDir(PERSONA), { recursive: true, force: true }))

describe('updateJob', () => {
  it('merges into the current job on disk, keeping edits made during a slow call', () => {
    const a = makeJob({ status: 'saved' })
    const b = makeJob()
    writeJobs(PERSONA, [a, b])

    // A request reads job a, then (while its AI call runs) the user marks it applied...
    writeJobs(PERSONA, readJobs(PERSONA).map(j => j.id === a.id ? { ...j, status: 'applied' as const } : j))
    // ...and the analysis finishes and saves only its own fields.
    const saved = updateJob(PERSONA, a.id, { fitScore: 72 })

    expect(saved?.status).toBe('applied')
    expect(saved?.fitScore).toBe(72)
    expect(saved?.updatedAt).not.toBe(a.updatedAt)
    expect(readJobs(PERSONA).find(j => j.id === b.id)).toEqual(b)
  })

  it('returns undefined and writes nothing when the job was deleted', () => {
    const before = readJobs(PERSONA)
    expect(updateJob(PERSONA, 'gone', { fitScore: 1 })).toBeUndefined()
    expect(readJobs(PERSONA)).toEqual(before)
  })
})
