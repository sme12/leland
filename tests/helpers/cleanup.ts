import type { Page } from '@playwright/test';

import { testIds } from '../../src/testing/test-ids';

export async function waitForCustomersListLoaded(page: Page) {
  // Don't use networkidle — Vite's HMR websocket keeps the network "active" forever in dev.
  // The list section flips data-loaded to "true" once TanStack Query settles.
  await page
    .locator(
      `[data-testid="${testIds.customersList.root}"][data-loaded="true"]`,
    )
    .waitFor({ state: 'attached', timeout: 10_000 });
}

export async function waitForMaterialsListLoaded(page: Page) {
  await page
    .locator(
      `[data-testid="${testIds.materialsList.root}"][data-loaded="true"]`,
    )
    .waitFor({ state: 'attached', timeout: 10_000 });
}

export async function waitForPurchasesListLoaded(page: Page) {
  await page
    .locator(
      `[data-testid="${testIds.purchasesList.root}"][data-loaded="true"]`,
    )
    .waitFor({ state: 'attached', timeout: 10_000 });
}

export async function waitForVisitsListLoaded(page: Page) {
  await page
    .locator(`[data-testid="${testIds.visitsList.root}"][data-loaded="true"]`)
    .waitFor({ state: 'attached', timeout: 10_000 });
}

async function collectCustomerIds(
  page: Page,
  prefix: string,
): Promise<string[]> {
  await waitForCustomersListLoaded(page);
  return page.getByTestId(testIds.customersList.row).evaluateAll(
    (items, namePrefix) =>
      items
        .filter(
          (li) =>
            Boolean(li.textContent) && li.textContent.includes(namePrefix),
        )
        .map((li) => li.getAttribute('data-customer-id'))
        .filter((id): id is string => Boolean(id)),
    prefix,
  );
}

async function collectMaterialIds(
  page: Page,
  prefix: string,
): Promise<string[]> {
  await waitForMaterialsListLoaded(page);
  return page.getByTestId(testIds.materialsList.row).evaluateAll(
    (items, namePrefix) =>
      items
        .filter(
          (li) =>
            Boolean(li.textContent) && li.textContent.includes(namePrefix),
        )
        .map((li) => li.getAttribute('data-material-id'))
        .filter((id): id is string => Boolean(id)),
    prefix,
  );
}

async function collectPurchaseIds(
  page: Page,
  prefix: string,
): Promise<string[]> {
  await waitForPurchasesListLoaded(page);
  return page.getByTestId(testIds.purchasesList.row).evaluateAll(
    (items, namePrefix) =>
      items
        .filter(
          (li) =>
            Boolean(li.textContent) && li.textContent.includes(namePrefix),
        )
        .map((li) => li.getAttribute('data-purchase-id'))
        .filter((id): id is string => Boolean(id)),
    prefix,
  );
}

async function collectVisitIds(page: Page, prefix: string): Promise<string[]> {
  await waitForVisitsListLoaded(page);
  return page
    .locator(`[data-testid="${testIds.visitsList.row}"][data-visit-id]`)
    .evaluateAll(
      (items, namePrefix) =>
        items
          .filter(
            (li) =>
              Boolean(li.textContent) && li.textContent.includes(namePrefix),
          )
          .map((li) => li.getAttribute('data-visit-id'))
          .filter((id): id is string => Boolean(id)),
      prefix,
    );
}

async function collectVisitDraftIds(
  page: Page,
  prefix: string,
): Promise<string[]> {
  await waitForVisitsListLoaded(page);
  return page
    .locator(`[data-testid="${testIds.visitsList.row}"][data-visit-draft-id]`)
    .evaluateAll(
      (items, namePrefix) =>
        items
          .filter(
            (li) =>
              Boolean(li.textContent) && li.textContent.includes(namePrefix),
          )
          .map((li) => li.getAttribute('data-visit-draft-id'))
          .filter((id): id is string => Boolean(id)),
      prefix,
    );
}

export async function cleanupCustomersByPrefix(page: Page, prefix: string) {
  try {
    const ids = new Set<string>();

    await page.goto('/customers');
    for (const id of await collectCustomerIds(page, prefix)) ids.add(id);

    await page.getByTestId(testIds.customersList.archivedTab).click();
    for (const id of await collectCustomerIds(page, prefix)) ids.add(id);

    console.log(
      `[cleanup] found ${ids.size} customer(s) matching "${prefix}" to delete`,
    );

    const results = await Promise.all(
      Array.from(ids).map(async (id) => {
        try {
          const res = await page.request.delete(`/api/test/customers/${id}`);
          return { id, status: res.status(), ok: res.ok() };
        } catch (error) {
          return { id, status: 0, ok: false, error };
        }
      }),
    );

    const failed = results.filter((r) => !r.ok);
    if (failed.length > 0) {
      console.warn(
        '[cleanup] DELETE /api/test/customers failed for some rows:',
        failed,
        '— If you see 404s, the dev server is missing E2E_TEST_MODE=true (restart it after creating .env.test).',
      );
    }
  } catch (error) {
    // Best-effort cleanup; don't mask the original test failure.
    console.warn('[cleanup] cleanupCustomersByPrefix failed:', error);
  }
}

export async function cleanupMaterialsByPrefix(page: Page, prefix: string) {
  try {
    const ids = new Set<string>();

    await page.goto('/materials');
    for (const id of await collectMaterialIds(page, prefix)) ids.add(id);

    await page.getByTestId(testIds.materialsList.archivedButton).click();
    for (const id of await collectMaterialIds(page, prefix)) ids.add(id);

    console.log(
      `[cleanup] found ${ids.size} material(s) matching "${prefix}" to delete`,
    );

    const results = await Promise.all(
      Array.from(ids).map(async (id) => {
        try {
          const res = await page.request.delete(`/api/test/materials/${id}`);
          return { id, status: res.status(), ok: res.ok() };
        } catch (error) {
          return { id, status: 0, ok: false, error };
        }
      }),
    );

    const failed = results.filter((r) => !r.ok);
    if (failed.length > 0) {
      console.warn(
        '[cleanup] DELETE /api/test/materials failed for some rows:',
        failed,
        '— If you see 404s, the dev server is missing E2E_TEST_MODE=true (restart it after creating .env.test).',
      );
    }
  } catch (error) {
    console.warn('[cleanup] cleanupMaterialsByPrefix failed:', error);
  }
}

export async function cleanupPurchasesByPrefix(page: Page, prefix: string) {
  try {
    const ids = new Set<string>();

    await page.goto('/purchases');
    for (const id of await collectPurchaseIds(page, prefix)) ids.add(id);

    console.log(
      `[cleanup] found ${ids.size} purchase(s) matching "${prefix}" to delete`,
    );

    const results = await Promise.all(
      Array.from(ids).map(async (id) => {
        try {
          const res = await page.request.delete(`/api/test/purchases/${id}`);
          return { id, status: res.status(), ok: res.ok() };
        } catch (error) {
          return { id, status: 0, ok: false, error };
        }
      }),
    );

    const failed = results.filter((r) => !r.ok);
    if (failed.length > 0) {
      console.warn(
        '[cleanup] DELETE /api/test/purchases failed for some rows:',
        failed,
        '— If you see 404s, the dev server is missing E2E_TEST_MODE=true (restart it after creating .env.test).',
      );
    }
  } catch (error) {
    console.warn('[cleanup] cleanupPurchasesByPrefix failed:', error);
  }
}

export async function cleanupVisitsByPrefix(page: Page, prefix: string) {
  try {
    const ids = new Set<string>();

    await page.goto('/visits');
    for (const id of await collectVisitIds(page, prefix)) ids.add(id);

    console.log(
      `[cleanup] found ${ids.size} visit(s) matching "${prefix}" to delete`,
    );

    const results = await Promise.all(
      Array.from(ids).map(async (id) => {
        try {
          const res = await page.request.delete(`/api/test/visits/${id}`);
          return { id, status: res.status(), ok: res.ok() };
        } catch (error) {
          return { id, status: 0, ok: false, error };
        }
      }),
    );

    const failed = results.filter((r) => !r.ok);
    if (failed.length > 0) {
      console.warn(
        '[cleanup] DELETE /api/test/visits failed for some rows:',
        failed,
        '— If you see 404s, the dev server is missing E2E_TEST_MODE=true (restart it after creating .env.test).',
      );
    }
  } catch (error) {
    console.warn('[cleanup] cleanupVisitsByPrefix failed:', error);
  }
}

export async function cleanupVisitDraftsByPrefix(page: Page, prefix: string) {
  try {
    const ids = new Set<string>();

    await page.goto('/visits');
    for (const id of await collectVisitDraftIds(page, prefix)) ids.add(id);

    console.log(
      `[cleanup] found ${ids.size} visit draft(s) matching "${prefix}" to discard`,
    );

    for (const id of ids) {
      try {
        await page.goto(`/visits/drafts/${id}/edit`);
        page.once('dialog', (dialog) => dialog.accept());
        await page.getByTestId(testIds.visitDraftEdit.discardButton).click();
        await waitForVisitsListLoaded(page);
      } catch (error) {
        console.warn('[cleanup] discard visit draft failed:', { id, error });
      }
    }
  } catch (error) {
    console.warn('[cleanup] cleanupVisitDraftsByPrefix failed:', error);
  }
}
