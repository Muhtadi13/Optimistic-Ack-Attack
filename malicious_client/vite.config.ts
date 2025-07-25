import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true
  },
  build: {
    outDir: 'dist-ui',
    sourcemap: true
  },
  define: {
    global: 'globalThis',
  },
  resolve: {
    alias: {
      // Prevent Node.js modules from being bundled
      'events': 'events',
      'buffer': 'buffer',
      'process': 'process/browser',
      'util': 'util'
    }
  },
  optimizeDeps: {
    exclude: ['events', 'buffer', 'process', 'util']
  }
})