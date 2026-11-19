import path from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname) } },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // Tests never call the real API: demo mode makes the AI functions use the local mocks.
    env: { DEMO_MODE: 'true', ANTHROPIC_API_KEY: '' },
  },
})
