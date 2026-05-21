import { signInAs } from './helpers/auth';
import type { Page } from '@playwright/test';
import { testIds } from '../src/testing/test-ids';
import {
  expect,
  registerE2eCleanup,
  skipIfE2eEnvMissing,
  test,
  uniqueCustomerName,
  uniqueMaterialName,
} from './helpers/e2e';
import {
  createCustomer,
  createMaterial,
  createMaterialPurchase,
  createPurchaseForExistingMaterial,
  pickCustomer,
  pickMaterial,
  pickService,
} from './helpers/flows';
import { clickAppNav } from './helpers/navigation';

skipIfE2eEnvMissing();
registerE2eCleanup();

test('visit creation computes material cost and buy-first preselects purchase', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await signInAs(page, 'A');
  const customerName = uniqueCustomerName('Visit');
  const colorName = uniqueMaterialName('Visit Color');
  const developerName = uniqueMaterialName('Visit Developer');
  const zeroPurchaseName = uniqueMaterialName('Visit Zero');

  await createCustomer(page, customerName);
  await createMaterialPurchase(page, colorName, 'color', '100', '20');
  await createMaterialPurchase(page, developerName, 'developer', '200', '10');
  await createMaterial(page, zeroPurchaseName, 'other');

  await clickAppNav(page, 'visits');
  await page.getByTestId(testIds.visitsList.addLink).click();
  await pickCustomer(page, customerName);

  await page.getByTestId(testIds.visitForm.addMaterialButton).click();
  await pickMaterial(page, colorName);
  await page.getByTestId(testIds.visitForm.materialAmountInput).fill('10');

  await page.getByTestId(testIds.visitForm.addMaterialButton).click();
  await pickMaterial(page, developerName);
  await page
    .getByTestId(testIds.visitForm.materialAmountInput)
    .nth(1)
    .fill('20');

  await pickService(page, 'service.color');
  await page.getByTestId(testIds.visitForm.priceInput).fill('40');
  await page.getByTestId(testIds.visitNew.saveButton).click();

  await expect(page.getByTestId(testIds.visitsList.root)).toContainText(
    customerName,
  );
  await expect(page.getByTestId(testIds.visitsList.root)).toContainText(
    '€3.00',
  );

  await clickVisitRow(page, customerName);
  await expect(page.getByTestId(testIds.visitDetail.materials)).toContainText(
    colorName,
  );
  await expect(page.getByTestId(testIds.visitDetail.materials)).toContainText(
    developerName,
  );
  await expect(page.getByTestId(testIds.visitDetail.materials)).toContainText(
    /€0\.20\/ml/,
  );
  await expect(page.getByTestId(testIds.visitDetail.materials)).toContainText(
    /€0\.05\/ml/,
  );
  await expect(page.getByTestId(testIds.visitDetail.summary)).toContainText(
    '€37.00',
  );
  const visitPath = new URL(page.url()).pathname;

  await page.getByTestId(testIds.visitDetail.editLink).click();
  await page
    .getByTestId(testIds.visitForm.materialAmountInput)
    .first()
    .fill('5');
  await page.getByTestId(testIds.visitEdit.saveButton).click();
  await expect(page.getByTestId(testIds.visitDetail.materials)).toContainText(
    /€0\.20\/ml/,
  );
  await expect(page.getByTestId(testIds.visitDetail.summary)).toContainText(
    '€38.00',
  );

  await page.getByTestId(testIds.visitDetail.editLink).click();
  await page
    .getByTestId(testIds.visitForm.lineItem)
    .first()
    .getByTestId(testIds.visitForm.materialTrigger)
    .click();
  await page
    .getByTestId(testIds.visitForm.materialSearchInput)
    .fill(developerName);
  await page
    .getByTestId(testIds.visitForm.materialOption)
    .filter({ hasText: developerName })
    .click();
  await page.getByTestId(testIds.visitEdit.saveButton).click();
  await expect(page.getByTestId(testIds.visitDetail.summary)).toContainText(
    '€38.75',
  );

  await createPurchaseForExistingMaterial(page, developerName, '200', '200');
  await page.goto(visitPath);
  await expect(page.getByTestId(testIds.visitDetail.summary)).toContainText(
    '€38.75',
  );
  await expect(page.getByTestId(testIds.visitDetail.materials)).toContainText(
    /€0\.05\/ml/,
  );

  await clickAppNav(page, 'visits');
  await page.getByTestId(testIds.visitsList.addLink).click();
  await pickCustomer(page, customerName);
  await page.getByTestId(testIds.visitForm.addMaterialButton).click();
  await page.getByTestId(testIds.visitForm.materialTrigger).last().click();
  await page
    .getByTestId(testIds.visitForm.materialSearchInput)
    .fill(zeroPurchaseName);
  await expect(
    page.getByTestId(testIds.visitForm.materialBuyFirstButton),
  ).toBeVisible();
  await page.getByTestId(testIds.visitForm.materialBuyFirstButton).click();
  await expect(page.getByTestId(testIds.purchaseNew.root)).toBeVisible();
  await expect(
    page.getByTestId(testIds.purchaseForm.materialSummary),
  ).toContainText(zeroPurchaseName);
});

async function clickVisitRow(page: Page, name: string) {
  await page
    .getByTestId(testIds.visitsList.row)
    .filter({ hasText: name })
    .locator('a')
    .click();
}
