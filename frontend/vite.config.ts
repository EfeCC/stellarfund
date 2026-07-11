/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],

  build: {
    rollupOptions: {
      output: {
        // The Stellar SDK is most of the bundle and it only changes when we bump
        // it. Splitting it out means shipping an app change does not invalidate
        // it in everyone's cache.
        advancedChunks: {
          groups: [{ name: 'stellar', test: /node_modules[\\/]@stellar[\\/]/ }],
        },
      },
    },
  },

  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    // `*.live.test.ts` talks to the real testnet deployment. Kept out of the
    // default run — and out of CI — so the suite never fails because someone
    // else's RPC node had a bad minute. Run it after a deploy: `npm run test:live`.
    exclude: ['**/node_modules/**', '**/dist/**', '**/*.live.test.ts'],
    // The contract clients are generated, not written; excluding them keeps the
    // coverage figures about code we are actually responsible for.
    coverage: {
      exclude: ['src/contracts/**', 'src/main.tsx', '**/*.config.*', 'src/test/**'],
    },
  },
})
