import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  // The e2e server is `storybook dev`, which compiles each story on first
  // request. On slower CI runners (notably Linux WebKit) that cold compile can
  // push the first interaction past a tight budget, so allow generous headroom.
  timeout: 30_000,
  // Retry on CI: a first attempt warms Storybook's on-demand story compile, so
  // the retry hits a compiled story and runs fast. Also absorbs known
  // CPU-contention flakiness under full parallel load. Locally, no retries.
  retries: process.env.CI ? 2 : 0,
  // Tests tagged @real hit third-party networks and are nondeterministic, so
  // they never block; opt in with REELY_REAL_PROVIDERS=1.
  grepInvert: process.env.REELY_REAL_PROVIDERS ? undefined : /@real/,
  use: { baseURL: 'http://127.0.0.1:4173' },
  webServer: {
    command:
      'pnpm --filter @reely/storybook exec storybook dev --ci --no-open -p 4173 --host 127.0.0.1',
    url: 'http://127.0.0.1:4173/iframe.html?id=fixtures-playerfixture--native-mp-4&viewMode=story',
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
