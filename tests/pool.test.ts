import { describe, expect, it } from 'vitest'
import { runPool } from '@/lib/pool'

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

describe('runPool', () => {
  it('never runs more than the limit at once and keeps result order', async () => {
    let running = 0
    let peak = 0
    const items = [30, 5, 20, 10, 1, 15, 25, 2]
    const results = await runPool(items, 3, async ms => {
      running++; peak = Math.max(peak, running)
      await sleep(ms)
      running--
      return ms * 2
    })
    expect(peak).toBe(3)
    expect(results.map(r => r.ok && r.value)).toEqual(items.map(ms => ms * 2))
  })

  it('keeps going after a failure and reports progress for every item', async () => {
    const progress: number[] = []
    const results = await runPool([1, 2, 3, 4], 2, async n => {
      if (n === 2) throw new Error('boom')
      return n
    }, done => progress.push(done))
    expect(results[1].ok).toBe(false)
    expect(results.filter(r => r.ok)).toHaveLength(3)
    expect(progress).toEqual([1, 2, 3, 4])
  })

  it('handles an empty list and a limit larger than the list', async () => {
    expect(await runPool([], 4, async x => x)).toEqual([])
    expect((await runPool([1], 10, async x => x + 1))[0]).toEqual({ ok: true, value: 2 })
  })

  it('is faster than running one at a time', async () => {
    const start = Date.now()
    await runPool([40, 40, 40, 40], 4, ms => sleep(ms))
    expect(Date.now() - start).toBeLessThan(120)
  })
})
