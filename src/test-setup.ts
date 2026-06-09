import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// vitest runs with `globals: false`, so Testing Library can't auto-register its
// afterEach hook — wire cleanup explicitly to unmount the DOM between tests.
afterEach(() => {
  cleanup()
})
