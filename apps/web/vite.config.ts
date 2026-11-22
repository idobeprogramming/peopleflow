import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.WEB_PORT ?? 5173),
    proxy: {
      // Keep the browser's Host header: the API checks it against Origin to block cross-site writes.
      '/api': { target: `http://localhost:${process.env.PORT ?? 3000}`, changeOrigin: false },
    },
  },
})
