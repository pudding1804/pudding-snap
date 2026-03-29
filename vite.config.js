import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 5175,
    strictPort: false,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
})
