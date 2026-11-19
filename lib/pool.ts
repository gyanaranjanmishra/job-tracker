/**
 * Run `worker` over `items` with at most `limit` running at once.
 * Results keep the input order. A failing item does not stop the others:
 * its slot holds the error. `onSettled` fires after each item with the count done so far.
 */
export async function runPool<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
  onSettled?: (done: number, total: number) => void,
): Promise<Array<{ ok: true; value: R } | { ok: false; error: unknown }>> {
  const results: Array<{ ok: true; value: R } | { ok: false; error: unknown }> = new Array(items.length)
  let next = 0
  let done = 0
  const lane = async () => {
    while (next < items.length) {
      const i = next++
      try { results[i] = { ok: true, value: await worker(items[i], i) } }
      catch (error) { results[i] = { ok: false, error } }
      done++
      onSettled?.(done, items.length)
    }
  }
  const lanes = Math.max(1, Math.min(limit, items.length))
  await Promise.all(Array.from({ length: lanes }, lane))
  return results
}
