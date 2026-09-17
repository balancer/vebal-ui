import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3002,
  },
  build: {
    rollupOptions: {
      output: {
        // Vite 8 (rolldown) requires the function form.
          manualChunks(id) {
          if (id.includes('node_modules/viem') || id.includes('node_modules/ox')) return 'viem'
            if (id.includes('node_modules/react')) return 'vendor'
          },
        },
      },
  },
})
