import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

import { testIds } from '../../src/testing/test-ids';

type AppNavDestination = 'customers' | 'materials' | 'purchases' | 'visits';

const appNavLinks: Record<AppNavDestination, string> = {
  customers: testIds.appNav.customersLink,
  materials: testIds.appNav.materialsLink,
  purchases: testIds.appNav.purchasesLink,
  visits: testIds.appNav.visitsLink,
};

export async function clickAppNav(page: Page, destination: AppNavDestination) {
  const linkTestId = appNavLinks[destination];
  const visibleLink = page.getByTestId(linkTestId).first();

  if ((await visibleLink.count()) > 0 && (await visibleLink.isVisible())) {
    await visibleLink.click();
    return;
  }

  const menuButton = page.getByTestId(testIds.appNav.menuButton);
  const drawer = page.getByTestId(testIds.appNav.menuDrawer);
  const drawerLink = drawer.getByTestId(linkTestId);

  await expect(menuButton).toBeVisible();
  await menuButton.click();
  await expect(drawer).toBeVisible();
  await expect(drawerLink).toBeVisible();
  await drawerLink.click();
}
