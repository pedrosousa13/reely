import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 10_000,
  use: { baseURL: 'http://127.0.0.1:4173' },
  webServer: {
    command:
      './node_modules/.bin/vite preview apps/docs --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    gracefulShutdown: { signal: 'SIGTERM', timeout: 500 },
    reuseExistingServer: !process.env.CI
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } }
  ]
});
