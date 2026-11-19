import type { Job } from '@/lib/storage'

let n = 0

/** A minimal valid job; override any field. */
export function makeJob(over: Partial<Job> = {}): Job {
  n += 1
  return {
    id: `job-${n}`,
    title: 'Data Scientist',
    company: 'Acme Inc',
    location: 'Toronto, ON',
    url: `https://jobs.example.com/${n}`,
    description: 'Python, SQL and machine learning.',
    status: 'saved',
    notes: '',
    appliedDate: '',
    createdAt: '2026-01-10T00:00:00.000Z',
    updatedAt: '2026-01-10T00:00:00.000Z',
    ...over,
  }
}
