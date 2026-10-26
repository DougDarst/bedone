import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 8097);

/**
 * End-to-end tests against the built app served by a real PocketBase.
 * Run with `npm run test:e2e` (builds first).
 */
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    timezoneId: 'America/Los_Angeles',
    trace: 'retain-on-failure',
  },
  projects: [
    // Chrome on iOS uses WebKit, so the primary target is tested on WebKit.
    { name: 'iphone-webkit', use: { ...devices['iPhone 15'] } },
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: './scripts/e2e-server.sh',
    url: `http://127.0.0.1:${PORT}/api/health`,
    reuseExistingServer: false,
    env: { E2E_PORT: String(PORT) },
  },
});
