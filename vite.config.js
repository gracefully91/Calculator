import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  // Project Pages is served from /Calculator/, whereas local Vite runs at /.
  // Keeping the base conditional makes both URLs work without a manual switch.
  base: process.env.GITHUB_ACTIONS ? '/Calculator/' : '/',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.js'],
    globals: true,
  },
})
