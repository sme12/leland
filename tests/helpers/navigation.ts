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
  const visibleLink = page.getByTestId(appNavLinks[destination]).first();

  if ((await visibleLink.count()) > 0 && (await visibleLink.isVisible())) {
    await visibleLink.click();
    return;
  }

  const menuButton = page.getByTestId(testIds.appNav.menuButton);
  const drawerLink = page.getByTestId(appNavLinks[destination]).first();

  await expect(menuButton).toBeVisible();

  for (let attempt = 0; attempt < 4; attempt += 1) {
    await menuButton.click();

    try {
      await expect(drawerLink).toBeVisible({ timeout: 1000 });
      await drawerLink.click();
      return;
    } catch {
      await page.waitForTimeout(250);
    }
  }

  await drawerLink.click();
}
