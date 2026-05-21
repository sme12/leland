import { signInAs } from './helpers/auth';
import { waitForCustomersListLoaded } from './helpers/cleanup';
import { testIds } from '../src/testing/test-ids';
import {
  expect,
  registerE2eCleanup,
  skipIfE2eEnvMissing,
  test,
  uniqueCustomerName,
} from './helpers/e2e';
import { createCustomer } from './helpers/flows';

skipIfE2eEnvMissing();
registerE2eCleanup();

test('customer data is scoped to the signed-in stylist', async ({ page }) => {
  await signInAs(page, 'A');
  const customerName = uniqueCustomerName('Scoped Customer');

  await createCustomer(page, customerName, 'Only Stylist A should see this');

  await signInAs(page, 'B');
  await waitForCustomersListLoaded(page);
  await expect(page.getByTestId(testIds.customersList.root)).not.toContainText(
    customerName,
  );
});
