import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true, // 端口占用时直接报错，不漂移，保证 bridge CORS 白名单可靠
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
})
