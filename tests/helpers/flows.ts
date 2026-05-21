import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

import { testIds } from '../../src/testing/test-ids';
import { clickAppNav } from './navigation';

export async function createCustomer(
  page: Page,
  name: string,
  comment = 'Created by E2E',
) {
  await page.goto('/customers/new');
  await expect(page.getByTestId(testIds.customerForm.root)).toBeVisible();
  await page.getByTestId(testIds.customerForm.nameInput).fill(name);
  await page.getByTestId(testIds.customerForm.commentInput).fill(comment);
  await page.getByTestId(testIds.customerForm.submitButton).click();
  await expect(page.getByTestId(testIds.customersList.root)).toContainText(
    name,
  );
}

export async function createMaterial(
  page: Page,
  name: string,
  category: string,
  unit = 'ml',
) {
  await page.goto('/materials/new');
  await expect(page.getByTestId(testIds.materialForm.root)).toBeVisible();
  await page.getByTestId(testIds.materialForm.nameInput).fill(name);
  await page
    .getByTestId(testIds.materialForm.categorySelect)
    .selectOption(category);
  await page.getByTestId(testIds.materialForm.unitSelect).selectOption(unit);
  await page.getByTestId(testIds.materialForm.submitButton).click();
  await expect(page.getByTestId(testIds.materialsList.root)).toContainText(
    name,
  );
}

export async function selectExistingPurchaseMaterial(
  page: Page,
  materialName: string,
) {
  const materialSelect = page.getByTestId(
    testIds.purchaseMaterialSelect.select,
  );

  await expect(materialSelect).toContainText(materialName);
  const materialValue = await materialSelect.evaluate(
    (select, name) =>
      Array.from((select as HTMLSelectElement).options).find(
        (option) => option.textContent.trim() === name,
      )?.value,
    materialName,
  );

  expect(materialValue).toBeTruthy();
  await materialSelect.selectOption(materialValue ?? '');
}

export async function createPurchaseForExistingMaterial(
  page: Page,
  materialName: string,
  quantity: string,
  price: string,
) {
  await page.goto('/purchases/new');
  await expect(page.getByTestId(testIds.purchaseNew.root)).toBeVisible();
  await selectExistingPurchaseMaterial(page, materialName);
  await page.getByTestId(testIds.purchaseForm.countInput).fill('1');
  await page.getByTestId(testIds.purchaseForm.sizeEachInput).fill(quantity);
  await page.getByTestId(testIds.purchaseForm.totalPriceInput).fill(price);
  await page.getByTestId(testIds.purchaseForm.submitButton).click();
  await expect(page.getByTestId(testIds.purchasesList.root)).toContainText(
    materialName,
  );
}

export async function createMaterialPurchase(
  page: Page,
  materialName: string,
  category: string,
  quantity: string,
  price: string,
) {
  await createMaterial(page, materialName, category);

  await clickAppNav(page, 'purchases');
  await page.getByTestId(testIds.purchasesList.addLink).click();
  await selectExistingPurchaseMaterial(page, materialName);
  await page.getByTestId(testIds.purchaseForm.countInput).fill('1');
  await page.getByTestId(testIds.purchaseForm.sizeEachInput).fill(quantity);
  await page.getByTestId(testIds.purchaseForm.totalPriceInput).fill(price);
  await page.getByTestId(testIds.purchaseForm.submitButton).click();
  await expect(page.getByTestId(testIds.purchasesList.root)).toContainText(
    materialName,
  );
}

export async function pickCustomer(page: Page, customerName: string) {
  await page.getByTestId(testIds.visitForm.customerTrigger).click();
  await page
    .getByTestId(testIds.visitForm.customerSearchInput)
    .fill(customerName);
  await page
    .getByTestId(testIds.visitForm.customerOption)
    .filter({ hasText: customerName })
    .click();
}

export async function pickMaterial(page: Page, materialName: string) {
  await page.getByTestId(testIds.visitForm.materialTrigger).last().click();
  await page
    .getByTestId(testIds.visitForm.materialSearchInput)
    .fill(materialName);
  await page
    .getByTestId(testIds.visitForm.materialOption)
    .filter({ hasText: materialName })
    .click();
}

export async function pickService(page: Page, serviceKey: string) {
  await page.getByTestId(testIds.visitForm.serviceTrigger).click();
  await optionByValue(
    page,
    testIds.visitForm.serviceOption,
    serviceKey,
  ).click();
}

function optionByValue(page: Page, testId: string, value: string) {
  return page.locator(
    `[data-testid="${testId}"][data-option-value="${value}"]`,
  );
}
