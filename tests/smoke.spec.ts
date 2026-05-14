import { expect, test } from '@playwright/test';

import { e2eEnvReady, signInAs } from './helpers/auth';
import {
  cleanupCustomersByPrefix,
  cleanupMaterialsByPrefix,
  cleanupPurchasesByPrefix,
} from './helpers/cleanup';

const TEST_CUSTOMER_PREFIX = 'SMOKE ';
const TEST_MATERIAL_PREFIX = 'SMOKE MAT ';

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
    await cleanupPurchasesByPrefix(page, TEST_MATERIAL_PREFIX);
    await cleanupCustomersByPrefix(page, TEST_CUSTOMER_PREFIX);
    await cleanupMaterialsByPrefix(page, TEST_MATERIAL_PREFIX);
  } catch (error) {
    console.warn('[smoke.spec] afterAll cleanup failed:', error);
  } finally {
    await context.close();
  }
});

test('@smoke customer CRUD uses active and archived views', async ({
  page,
}) => {
  await signInAs(page, 'A');
  const suffix = Date.now();
  const name = `${TEST_CUSTOMER_PREFIX}Anna ${suffix}`;
  const renamed = `${TEST_CUSTOMER_PREFIX}Anna Edited ${suffix}`;

  await page.getByRole('link', { name: /add customer/i }).click();
  await page.getByLabel(/name/i).fill(name);
  await page.getByLabel(/comment/i).fill('Created by smoke E2E');
  await page.getByRole('button', { name: /create customer/i }).click();

  await expect(page.getByText(name)).toBeVisible();

  await page
    .getByRole('link', { name: new RegExp(`edit ${name}`, 'i') })
    .click();
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

test('@smoke service prices persist nulls and values', async ({ page }) => {
  await signInAs(page, 'A');
  await page.getByRole('link', { name: /service prices/i }).click();

  const other = page.getByLabel(/other/i);
  await expect(other).toHaveAttribute('placeholder', /set price/i);
  await other.fill('123.45');
  await other.blur();
  await expect(page.getByText(/price saved/i)).toBeVisible();
  await page.reload();
  await expect(page.getByLabel(/other/i)).toHaveValue('123.45');

  await page.getByLabel(/other/i).fill('');
  await page.getByLabel(/other/i).blur();
  await expect(page.getByText(/price saved/i)).toBeVisible();
  await page.reload();
  await expect(page.getByLabel(/other/i)).toHaveValue('');
});

test('@smoke purchase CRUD uses inline material flow', async ({ page }) => {
  test.setTimeout(60_000);
  await signInAs(page, 'A');
  const suffix = Date.now();
  const materialName = `${TEST_MATERIAL_PREFIX}Purchase Color ${suffix}`;
  const pieceMaterialName = `${TEST_MATERIAL_PREFIX}Purchase Piece ${suffix}`;

  await page.getByRole('link', { name: /purchases/i }).click();
  await page.getByRole('link', { name: /add purchase/i }).click();
  await page.getByRole('button', { name: /new material/i }).click();
  await page.getByLabel(/name/i).fill(materialName);
  await page.getByLabel(/category/i).selectOption('color');
  await page.getByLabel(/unit/i).selectOption('ml');
  await page.getByRole('button', { name: /create material/i }).click();

  await expect(
    page.locator('p').filter({ hasText: materialName }),
  ).toBeVisible();
  await page.getByLabel(/how many/i).fill('2');
  await page.getByLabel(/size each/i).fill('500');
  await page.getByLabel(/total price/i).fill('44.50');
  await page.getByLabel(/^date$/i).fill('2099-12-31');
  await page.getByRole('button', { name: /create purchase/i }).click();

  await expect(page.locator('section[data-purchases-list]')).toContainText(
    materialName,
  );
  await expect(
    page.locator('section[data-purchase-category="color"]'),
  ).toContainText(/1 purchase/i);

  await page.getByRole('link', { name: new RegExp(materialName) }).click();
  await expect(page.getByRole('heading', { name: materialName })).toBeVisible();
  await expect(page.getByText('1,000 ml')).toBeVisible();
  await expect(page.getByText('€44.50')).toBeVisible();
  await expect(page.getByText(/€0\.0445\/ml/)).toBeVisible();

  await page.getByRole('link', { name: /edit/i }).click();
  await page.getByLabel(/total quantity/i).fill('750');
  await page.getByLabel(/total price/i).fill('30');
  await page.getByRole('button', { name: /save purchase/i }).click();
  await expect(page.getByText('750 ml')).toBeVisible();
  await expect(page.getByText('€30.00')).toBeVisible();

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: /delete/i }).click();
  await expect(page.getByText(materialName)).toBeHidden();

  await page.getByRole('link', { name: /materials/i }).click();
  await expect(page.getByText(materialName)).toBeVisible();

  await page.getByRole('link', { name: /purchases/i }).click();
  await page.getByRole('link', { name: /add purchase/i }).click();
  await page.getByRole('button', { name: /new material/i }).click();
  await page.getByLabel(/name/i).fill(pieceMaterialName);
  await page.getByLabel(/category/i).selectOption('tools');
  await page.getByLabel(/unit/i).selectOption('piece');
  await page.getByRole('button', { name: /create material/i }).click();
  await expect(page.getByLabel(/^quantity$/i)).toBeVisible();
  await expect(page.getByLabel(/how many/i)).toHaveCount(0);
});

test('@smoke material CRUD uses grouped active and archived views', async ({
  page,
}) => {
  await signInAs(page, 'A');
  const suffix = Date.now();
  const name = `${TEST_MATERIAL_PREFIX}Color ${suffix}`;
  const renamed = `${TEST_MATERIAL_PREFIX}Brush ${suffix}`;

  await page.getByRole('link', { name: /materials/i }).click();
  await page.getByRole('link', { name: /add material/i }).click();
  await page.getByLabel(/name/i).fill(name);
  await page.getByLabel(/category/i).selectOption('color');
  await page.getByLabel(/unit/i).selectOption('ml');
  await page.getByRole('button', { name: /create material/i }).click();

  await expect(
    page.locator('section[data-material-category="color"]'),
  ).toContainText(name);

  await page
    .getByRole('link', { name: new RegExp(`edit ${name}`, 'i') })
    .click();
  await expect(page.getByLabel(/unit/i)).toHaveCount(0);
  await page.getByLabel(/name/i).fill(renamed);
  await page.getByLabel(/category/i).selectOption('tools');
  await page.getByRole('button', { name: /save material/i }).click();

  await expect(
    page.locator('section[data-material-category="tools"]'),
  ).toContainText(renamed);

  page.once('dialog', (dialog) => dialog.accept());
  await page
    .getByRole('button', { name: new RegExp(`archive ${renamed}`, 'i') })
    .click();
  await expect(page.getByText(renamed)).toBeHidden();

  await page.getByRole('button', { name: /archived/i }).click();
  await expect(page.getByText(renamed)).toBeVisible();

  page.once('dialog', (dialog) => dialog.accept());
  await page
    .getByRole('button', { name: new RegExp(`restore ${renamed}`, 'i') })
    .click();
  await expect(page.getByText(renamed)).toBeHidden();
});

test('customers and service prices are isolated by Clerk user', async ({
  page,
}) => {
  test.setTimeout(60_000);
  const suffix = Date.now();
  const isolatedName = `${TEST_CUSTOMER_PREFIX}Isolation ${suffix}`;
  const isolatedMaterial = `${TEST_MATERIAL_PREFIX}Isolation ${suffix}`;
  const isolatedPrice = `${200 + (suffix % 700)}.${String(suffix % 100).padStart(2, '0')}`;

  await signInAs(page, 'A');
  await page.getByRole('link', { name: /add customer/i }).click();
  await page.getByLabel(/name/i).fill(isolatedName);
  await page.getByRole('button', { name: /create customer/i }).click();
  await expect(page.getByText(isolatedName)).toBeVisible();

  await page.getByRole('link', { name: /purchases/i }).click();
  await expect(page.locator('section[data-purchases-list]')).toBeVisible();
  await page.getByRole('link', { name: /add purchase/i }).click();
  await page.getByRole('button', { name: /new material/i }).click();
  await page.getByLabel(/name/i).fill(isolatedMaterial);
  await page.getByLabel(/category/i).selectOption('other');
  await page.getByLabel(/unit/i).selectOption('piece');
  await page.getByRole('button', { name: /create material/i }).click();
  await expect(page.getByLabel(/^quantity$/i)).toBeVisible();
  await page.getByLabel(/^quantity$/i).fill('2');
  await page.getByLabel(/total price/i).fill('10');
  await page.getByRole('button', { name: /create purchase/i }).click();
  await expect(page.locator('section[data-purchases-list]')).toContainText(
    isolatedMaterial,
  );

  await page.getByRole('link', { name: /service prices/i }).click();
  const cutPrice = page.getByRole('textbox', { name: 'Cut', exact: true });
  await cutPrice.fill(isolatedPrice);
  await cutPrice.blur();
  await expect(cutPrice).toHaveValue(isolatedPrice);

  await signInAs(page, 'B');
  await expect(page.getByText(isolatedName)).toBeHidden();
  await page.getByRole('link', { name: /materials/i }).click();
  await expect(page.getByText(isolatedMaterial)).toHaveCount(0);
  await page.getByRole('link', { name: /purchases/i }).click();
  await expect(page.getByText(isolatedMaterial)).toHaveCount(0);
  await page.getByRole('link', { name: /service prices/i }).click();
  await expect(
    page.getByRole('textbox', { name: 'Cut', exact: true }),
  ).not.toHaveValue(isolatedPrice);
});
