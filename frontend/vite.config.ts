import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/health': 'http://127.0.0.1:8000',
      '/watermark': 'http://127.0.0.1:8000',
      '/metrics': 'http://127.0.0.1:8000',
      '/attacks': 'http://127.0.0.1:8000',
      '/robustness': 'http://127.0.0.1:8000',
      '/comparison': 'http://127.0.0.1:8000',
    },
  },
})
