import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Job Tracker — ATS Optimizer',
  description: 'Track jobs, optimize your resume for ATS, generate cover letters',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
