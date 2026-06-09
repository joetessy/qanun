import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Worker format `es` kept for parity with theremin — a future recorder
// sub-plan (P4) reuses its ESM worker.
export default defineConfig({
  base: '/',
  plugins: [react()],
  worker: { format: 'es' }
})
