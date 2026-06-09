import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Worker format `es` kept for parity with theremin — a future recorder
// sub-plan (P4) reuses its ESM worker.
//
// manualChunks splits the two heavy vendor libraries into separate assets so
// the main chunk stays under 500 kB:
//   - vendor-tone:       Tone.js audio engine (~320 kB gz)
//   - vendor-mediapipe:  @mediapipe/tasks-vision — loaded only on "play" press
//     (dynamic import in loadHandLandmarker.ts) so it's a lazy chunk too.
//   - vendor-react:      React + ReactDOM (relatively small, but isolated for
//     long-term caching).
export default defineConfig({
  base: '/',
  plugins: [react()],
  worker: { format: 'es' },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/tone') || id.includes('node_modules/Tone')) {
            return 'vendor-tone'
          }
          if (id.includes('node_modules/@mediapipe')) {
            return 'vendor-mediapipe'
          }
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) {
            return 'vendor-react'
          }
        },
      },
    },
  },
})
