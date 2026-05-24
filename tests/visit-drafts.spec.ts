import { signInAs } from './helpers/auth';
import type { Page } from '@playwright/test';
import { testIds } from '../src/testing/test-ids';
import {
  expect,
  helsinkiDateOnly,
  registerE2eCleanup,
  skipIfE2eEnvMissing,
  test,
  uniqueCustomerName,
} from './helpers/e2e';
import { createCustomer, pickCustomer, pickService } from './helpers/flows';
import { clickAppNav } from './helpers/navigation';

skipIfE2eEnvMissing();
registerE2eCleanup();

test('visit draft can be saved, edited, blocked while future-dated, and published without a separate save', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await signInAs(page, 'A');
  const customerName = uniqueCustomerName('Draft Visit');

  await createCustomer(page, customerName);

  await clickAppNav(page, 'visits');
  await page.getByTestId(testIds.visitsList.addLink).click();
  await pickCustomer(page, customerName);
  await pickService(page, 'service.cutAndColor');
  await page.getByTestId(testIds.visitForm.priceInput).fill('70');
  await page.getByTestId(testIds.visitForm.dateInput).fill('2999-01-01');
  await page.getByTestId(testIds.visitNew.saveDraftButton).click();

  await expect(page.getByTestId(testIds.visitsList.root)).toContainText(
    customerName,
  );
  await expect(
    visitRow(page, customerName).getByTestId(testIds.visitsList.draftBadge),
  ).toBeVisible();

  await clickVisitRow(page, customerName);
  await expect(page.getByTestId(testIds.visitDraftEdit.root)).toBeVisible();
  await expect(
    page.getByTestId(testIds.visitDraftEdit.publishButton),
  ).toBeDisabled();

  await page.getByTestId(testIds.visitForm.dateInput).fill(helsinkiDateOnly());
  await page.getByTestId(testIds.visitForm.priceInput).fill('75');

  await expect(
    page.getByTestId(testIds.visitDraftEdit.publishButton),
  ).toBeEnabled();
  await page.getByTestId(testIds.visitDraftEdit.publishButton).click();

  await expect(page.getByTestId(testIds.visitDetail.title)).toContainText(
    customerName,
  );
  await expect(page.getByTestId(testIds.visitDetail.summary)).toContainText(
    '€75.00',
  );
  await expect(page.getByTestId(testIds.visitDetail.pureLabor)).toBeVisible();
});

async function clickVisitRow(page: Page, name: string) {
  await visitRow(page, name).locator('a').click();
}

function visitRow(page: Page, name: string) {
  return page.getByTestId(testIds.visitsList.row).filter({ hasText: name });
}
