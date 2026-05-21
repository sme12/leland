import { signInAs } from './helpers/auth';
import { testIds } from '../src/testing/test-ids';
import {
  expect,
  registerE2eCleanup,
  skipIfE2eEnvMissing,
  test,
  uniqueMaterialName,
} from './helpers/e2e';

skipIfE2eEnvMissing();
registerE2eCleanup();

test('purchase can create a material inline and record stock cost', async ({
  page,
}) => {
  await signInAs(page, 'A');
  const materialName = uniqueMaterialName('Purchase Color');

  await page.goto('/purchases/new');
  await expect(page.getByTestId(testIds.purchaseNew.root)).toBeVisible();
  await page.getByTestId(testIds.purchaseNew.newMaterialToggle).click();
  await page.getByTestId(testIds.materialForm.nameInput).fill(materialName);
  await page
    .getByTestId(testIds.materialForm.categorySelect)
    .selectOption('color');
  await page.getByTestId(testIds.materialForm.unitSelect).selectOption('ml');
  await page.getByTestId(testIds.materialForm.submitButton).click();

  await expect(
    page.getByTestId(testIds.purchaseForm.materialSummary),
  ).toBeVisible();
  await expect(
    page.getByTestId(testIds.purchaseForm.materialSummary),
  ).toContainText(materialName);
  await page.getByTestId(testIds.purchaseForm.countInput).fill('2');
  await page.getByTestId(testIds.purchaseForm.sizeEachInput).fill('500');
  await page.getByTestId(testIds.purchaseForm.totalPriceInput).fill('44.50');
  await page.getByTestId(testIds.purchaseForm.dateInput).fill('2099-12-31');
  await page.getByTestId(testIds.purchaseForm.submitButton).click();

  await expect(page.getByTestId(testIds.purchasesList.root)).toContainText(
    materialName,
  );

  await page
    .getByTestId(testIds.purchasesList.row)
    .filter({ hasText: materialName })
    .locator('a')
    .click();
  await expect(page.getByTestId(testIds.purchaseDetail.title)).toContainText(
    materialName,
  );
  await expect(page.getByTestId(testIds.purchaseDetail.summary)).toContainText(
    '1,000 ml',
  );
  await expect(page.getByTestId(testIds.purchaseDetail.summary)).toContainText(
    '€44.50',
  );
  await expect(page.getByTestId(testIds.purchaseDetail.summary)).toContainText(
    /€0\.0445\/ml/,
  );
});
