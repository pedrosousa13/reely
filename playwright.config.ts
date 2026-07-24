import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 10_000,
  // Tests tagged @real hit third-party networks and are nondeterministic, so
  // they never block; opt in with REELY_REAL_PROVIDERS=1.
  grepInvert: process.env.REELY_REAL_PROVIDERS ? undefined : /@real/,
  use: { baseURL: 'http://127.0.0.1:4173' },
  webServer: {
    command:
      'pnpm --filter @reely/storybook exec storybook dev --ci --no-open -p 4173 --host 127.0.0.1',
    url: 'http://127.0.0.1:4173/iframe.html?id=fixtures-playerfixture--default&viewMode=story',
    gracefulShutdown: { signal: 'SIGTERM', timeout: 500 },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } }
  ]
});
