import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

import { cloudflare } from "@cloudflare/vite-plugin";

// Worker format `es` kept for parity with theremin — a future recorder
// sub-plan (P4) reuses its ESM worker.
//
// Chunking: only React is split out manually (eager, isolated for long-term
// caching). Tone.js and @mediapipe/tasks-vision are reached ONLY via dynamic
// import (first user gesture / "play" press), so automatic code splitting
// already gives each its own lazy chunk — and putting them in manualChunks
// made Rolldown link those chunks as STATIC imports of the entry, which
// modulepreloaded ~120 kB gz of audio + vision code the first paint never runs.
export default defineConfig({
  base: '/',
  plugins: [react(), cloudflare()],
  worker: { format: 'es' },
  // Honor an externally assigned port (preview/CI harnesses set PORT); normal
  // `npm run dev` leaves PORT unset and keeps Vite's default 5173.
  server: process.env.PORT ? { port: Number(process.env.PORT), strictPort: true } : undefined,
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) {
            return 'vendor-react'
          }
        },
      },
    },
  },
})