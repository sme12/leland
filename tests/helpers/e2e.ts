import { expect, test } from '@playwright/test';
import type { Browser } from '@playwright/test';

import { e2eEnvReady, signInAs } from './auth';
import {
  cleanupCustomersByPrefix,
  cleanupMaterialsByPrefix,
  cleanupPurchasesByPrefix,
  cleanupVisitDraftsByPrefix,
  cleanupVisitsByPrefix,
} from './cleanup';

export { expect, test };

export const TEST_CUSTOMER_PREFIX = 'SMOKE ';
export const TEST_MATERIAL_PREFIX = 'SMOKE MAT ';

export function skipIfE2eEnvMissing() {
  test.skip(
    !e2eEnvReady,
    'E2E requires Clerk, DATABASE_URL, and two distinct user emails.',
  );
}

export function registerE2eCleanup() {
  test.beforeAll(async ({ browser }) => {
    if (!e2eEnvReady) return;
    test.setTimeout(120_000);
    await cleanupE2eData(browser);
  });

  test.afterAll(async ({ browser }) => {
    if (!e2eEnvReady) return;
    test.setTimeout(120_000);
    await cleanupE2eData(browser);
  });
}

export async function cleanupE2eData(browser: Browser) {
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await signInAs(page, 'A');
    await cleanupVisitDraftsByPrefix(page, TEST_CUSTOMER_PREFIX);
    await cleanupVisitsByPrefix(page, TEST_CUSTOMER_PREFIX);
    await cleanupPurchasesByPrefix(page, TEST_MATERIAL_PREFIX);
    await cleanupCustomersByPrefix(page, TEST_CUSTOMER_PREFIX);
    await cleanupMaterialsByPrefix(page, TEST_MATERIAL_PREFIX);
  } catch (error) {
    console.warn('[e2e] cleanup failed:', error);
  } finally {
    await context.close();
  }
}

export function uniqueCustomerName(label: string) {
  return `${TEST_CUSTOMER_PREFIX}${label} ${uniqueSuffix()}`;
}

export function uniqueMaterialName(label: string) {
  return `${TEST_MATERIAL_PREFIX}${label} ${uniqueSuffix()}`;
}

export function helsinkiDateOnly(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Helsinki',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) {
    throw new Error('Could not format Helsinki date');
  }

  return `${year}-${month}-${day}`;
}

function uniqueSuffix() {
  return `${Date.now()} ${Math.random().toString(36).slice(2, 8)}`;
}
