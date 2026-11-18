/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // En desarrollo, /api se reenvía al backend FastAPI. Así front y back
    // comparten origen: no hace falta CORS y la cookie HttpOnly funciona.
    proxy: {
      '/api': { target: 'http://127.0.0.1:8000' },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
})
