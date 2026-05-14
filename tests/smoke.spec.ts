import { expect, test } from '@playwright/test';

import { e2eEnvReady, signInAs } from './helpers/auth';
import { cleanupCustomersByPrefix } from './helpers/cleanup';

const TEST_CUSTOMER_PREFIX = 'SMOKE ';

test.skip(
  !e2eEnvReady,
  'Smoke E2E requires Clerk, DATABASE_URL, and two distinct user emails.',
);

// Cleanup runs once after all tests in the file: faster (one sign-in instead of N) and
// decoupled from each test's 30s timeout. A fresh context isolates it from any broken
// state a failed test may have left in its own page.
test.afterAll(async ({ browser }) => {
  if (!e2eEnvReady) return;
  // Clerk sign-out + sign-in alone can take 15s; give the hook room.
  test.setTimeout(90_000);
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await signInAs(page, 'A');
    await cleanupCustomersByPrefix(page, TEST_CUSTOMER_PREFIX);
  } catch (error) {
    console.warn('[smoke.spec] afterAll cleanup failed:', error);
  } finally {
    await context.close();
  }
});

test('customer CRUD uses active and archived views', async ({ page }) => {
  await signInAs(page, 'A');
  const suffix = Date.now();
  const name = `${TEST_CUSTOMER_PREFIX}Anna ${suffix}`;
  const renamed = `${TEST_CUSTOMER_PREFIX}Anna Edited ${suffix}`;

  await page.getByRole('link', { name: /add customer/i }).click();
  await page.getByLabel(/name/i).fill(name);
  await page.getByLabel(/comment/i).fill('Created by smoke E2E');
  await page.getByRole('button', { name: /create customer/i }).click();

  await expect(page.getByText(name)).toBeVisible();

  await page.getByRole('link', { name: new RegExp(`edit ${name}`, 'i') }).click();
  await page.getByLabel(/name/i).fill(renamed);
  await page.getByRole('button', { name: /save customer/i }).click();
  await expect(page.getByText(renamed)).toBeVisible();

  page.once('dialog', (dialog) => dialog.accept());
  await page
    .getByRole('button', { name: new RegExp(`archive ${renamed}`, 'i') })
    .click();
  await expect(page.getByText(renamed)).toBeHidden();

  await page.getByRole('tab', { name: /archived/i }).click();
  await expect(page.getByText(renamed)).toBeVisible();

  page.once('dialog', (dialog) => dialog.accept());
  await page
    .getByRole('button', { name: new RegExp(`restore ${renamed}`, 'i') })
    .click();
  await expect(page.getByText(renamed)).toBeHidden();
});

test('service prices persist nulls and values', async ({ page }) => {
  await signInAs(page, 'A');
  await page.getByRole('link', { name: /service prices/i }).click();

  const other = page.getByLabel(/other/i);
  await expect(other).toHaveAttribute('placeholder', /set price/i);
  await other.fill('123.45');
  await other.blur();
  await page.reload();
  await expect(page.getByLabel(/other/i)).toHaveValue('123.45');

  await page.getByLabel(/other/i).fill('');
  await page.getByLabel(/other/i).blur();
  await page.reload();
  await expect(page.getByLabel(/other/i)).toHaveValue('');
});

test('customers and service prices are isolated by Clerk user', async ({
  page,
}) => {
  const suffix = Date.now();
  const isolatedName = `${TEST_CUSTOMER_PREFIX}Isolation ${suffix}`;
  const isolatedPrice = `${200 + (suffix % 700)}.${String(suffix % 100).padStart(2, '0')}`;

  await signInAs(page, 'A');
  await page.getByRole('link', { name: /add customer/i }).click();
  await page.getByLabel(/name/i).fill(isolatedName);
  await page.getByRole('button', { name: /create customer/i }).click();
  await expect(page.getByText(isolatedName)).toBeVisible();

  await page.getByRole('link', { name: /service prices/i }).click();
  const cutPrice = page.getByRole('textbox', { name: 'Cut', exact: true });
  await cutPrice.fill(isolatedPrice);
  await cutPrice.blur();
  await expect(cutPrice).toHaveValue(isolatedPrice);

  await signInAs(page, 'B');
  await expect(page.getByText(isolatedName)).toBeHidden();
  await page.getByRole('link', { name: /service prices/i }).click();
  await expect(
    page.getByRole('textbox', { name: 'Cut', exact: true }),
  ).not.toHaveValue(isolatedPrice);
});
