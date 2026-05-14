import { existsSync } from 'node:fs';
import process from 'node:process';

import { defineConfig, devices } from '@playwright/test';

// Load test-only env BEFORE Playwright spawns the dev server, so the server inherits
// these vars (e.g. E2E_TEST_MODE). process.loadEnvFile does not overwrite existing vars,
// so order = precedence (first wins).
for (const file of ['.env.test.local', '.env.test', '.env.local', '.env']) {
  if (existsSync(file)) process.loadEnvFile(file);
}

export default defineConfig({
  testDir: './tests',
  globalSetup: './tests/global-setup.ts',
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: 'pnpm dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
      },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
