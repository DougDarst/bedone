import { defineConfig } from 'vitest/config';

/**
 * Integration tests: run against a real PocketBase (with this repo's
 * migrations and hooks) started on a throwaway database by global-setup.ts.
 */
export default defineConfig({
  test: {
    include: ['tests/integration/**/*.test.ts'],
    globalSetup: ['tests/integration/global-setup.ts'],
    // Tests share one server; each creates its own users, so files can still
    // run in parallel.
    testTimeout: 15_000,
  },
});
