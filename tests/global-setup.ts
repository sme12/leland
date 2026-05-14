import { existsSync } from 'node:fs';
import process from 'node:process';

import { clerkSetup } from '@clerk/testing/playwright';

function loadEnvFile(path: string) {
  if (existsSync(path)) {
    process.loadEnvFile(path);
  }
}

export default async function globalSetup() {
  loadEnvFile('.env.test.local');
  loadEnvFile('.env.test');
  loadEnvFile('.env.local');
  loadEnvFile('.env');

  if (!process.env.CLERK_SECRET_KEY || !process.env.CLERK_PUBLISHABLE_KEY) {
    return;
  }

  await clerkSetup({ dotenv: false });
}
