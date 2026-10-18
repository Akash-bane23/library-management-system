import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
    // `npm run dev` starts scripts/dev.mjs, which serves the same serverless
    // handlers Vercel runs in production (api/*.js) on this port.
    proxy: {
      "/api": {
        target: `http://127.0.0.1:${process.env.DEV_API_PORT || 3001}`,
        changeOrigin: false,
      },
    },
  },
})
