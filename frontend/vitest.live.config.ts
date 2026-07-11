import { defineConfig } from 'vitest/config'

/**
 * Runs only the `*.live.test.ts` smoke tests, which talk to the real deployment
 * recorded in `src/config/deployment.json`.
 *
 * Deliberately a separate config: these need the network, and folding them into
 * the default suite would mean CI going red because someone else's RPC node had
 * a bad minute. Run them after a deploy:
 *
 *     npm run test:live
 */
export default defineConfig({
  test: {
    // No DOM: these exercise the service layer, not components.
    environment: 'node',
    globals: true,
    include: ['src/**/*.live.test.ts'],
    testTimeout: 30_000,
  },
})
