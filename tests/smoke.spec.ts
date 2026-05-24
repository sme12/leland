import { signInAs } from './helpers/auth';
import { testIds } from '../src/testing/test-ids';
import {
  expect,
  registerE2eCleanup,
  skipIfE2eEnvMissing,
  test,
  uniqueCustomerName,
} from './helpers/e2e';
import { createCustomer, pickCustomer, pickService } from './helpers/flows';
import { clickAppNav } from './helpers/navigation';

skipIfE2eEnvMissing();
registerE2eCleanup();

test('@smoke stylist can sign in and save a pure-labor visit', async ({
  page,
}) => {
  await signInAs(page, 'A');
  const customerName = uniqueCustomerName('Smoke Visit');

  await createCustomer(page, customerName);

  await clickAppNav(page, 'visits');
  await page.getByTestId(testIds.visitsList.addLink).click();
  await pickCustomer(page, customerName);
  await pickService(page, 'service.cutAndColor');
  await page.getByTestId(testIds.visitForm.priceInput).fill('50');
  await page.getByTestId(testIds.visitForm.dateInput).fill('2020-01-01');
  await page.getByTestId(testIds.visitNew.saveButton).click();

  await expect(page.getByTestId(testIds.visitsList.root)).toContainText(
    customerName,
  );
  await expect(page.getByTestId(testIds.visitsList.root)).toContainText(
    '€0.00',
  );
});
