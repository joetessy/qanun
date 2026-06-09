import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Vitest config. Kept separate from vite.config.ts so the production build
// doesn't pull in test-only globals. jsdom is the default env so component
// tests (later sub-plans) can mount without extra config; pure unit tests
// are unaffected.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: false,
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test-setup.ts']
  }
})
