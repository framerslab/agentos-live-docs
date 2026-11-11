// Runs e2e/consent.spec.mjs against the built site served from build/ (see the build job of .github/workflows/deploy.yml).
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: /consent\.spec\.mjs$/,
  timeout: 90_000,
  retries: 1,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    ...devices['Desktop Chrome'],
    trace: 'retain-on-failure',
  },
});
