import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// The `/api` proxy is a no-op in Phase 1 (all data is mocked in src/api/store.js).
// It's here so that when the BFF arrives in Phase 2, the front end can talk to a
// same-origin `/api` without any code change beyond src/api/store.js.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_BFF_ORIGIN || 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
})
