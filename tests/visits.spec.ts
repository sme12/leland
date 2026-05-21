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
  createMaterialPurchase,
  createPurchaseForExistingMaterial,
  pickCustomer,
  pickMaterial,
  pickService,
} from './helpers/flows';
import { clickAppNav } from './helpers/navigation';

skipIfE2eEnvMissing();
registerE2eCleanup();

test('visit creation locks material cost against later purchases', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await signInAs(page, 'A');
  const customerName = uniqueCustomerName('Visit');
  const colorName = uniqueMaterialName('Visit Color');

  await createCustomer(page, customerName);
  await createMaterialPurchase(page, colorName, 'color', '100', '20');

  await clickAppNav(page, 'visits');
  await page.getByTestId(testIds.visitsList.addLink).click();
  await pickCustomer(page, customerName);

  await page.getByTestId(testIds.visitForm.addMaterialButton).click();
  await pickMaterial(page, colorName);
  await page.getByTestId(testIds.visitForm.materialAmountInput).fill('10');

  await pickService(page, 'service.color');
  await page.getByTestId(testIds.visitForm.priceInput).fill('40');
  await page.getByTestId(testIds.visitNew.saveButton).click();

  await expect(page.getByTestId(testIds.visitsList.root)).toContainText(
    customerName,
  );
  await expect(page.getByTestId(testIds.visitsList.root)).toContainText(
    '€2.00',
  );

  await clickVisitRow(page, customerName);
  await expect(page.getByTestId(testIds.visitDetail.materials)).toContainText(
    colorName,
  );
  await expect(page.getByTestId(testIds.visitDetail.materials)).toContainText(
    /€0\.20\/ml/,
  );
  await expect(page.getByTestId(testIds.visitDetail.summary)).toContainText(
    '€38.00',
  );
  const visitPath = new URL(page.url()).pathname;

  await createPurchaseForExistingMaterial(page, colorName, '100', '100');
  await page.goto(visitPath);
  await expect(page.getByTestId(testIds.visitDetail.summary)).toContainText(
    '€38.00',
  );
  await expect(page.getByTestId(testIds.visitDetail.materials)).toContainText(
    /€0\.20\/ml/,
  );
});

async function clickVisitRow(page: Page, name: string) {
  await page
    .getByTestId(testIds.visitsList.row)
    .filter({ hasText: name })
    .locator('a')
    .click();
}
