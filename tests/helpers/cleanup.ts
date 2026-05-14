import type { Page } from '@playwright/test';

async function waitForCustomersListLoaded(page: Page) {
  // Don't use networkidle — Vite's HMR websocket keeps the network "active" forever in dev.
  // The list section flips data-loaded to "true" once TanStack Query settles.
  await page
    .locator('section[data-customers-list][data-loaded="true"]')
    .waitFor({ state: 'attached', timeout: 10_000 });
}

async function collectCustomerIds(
  page: Page,
  prefix: string,
): Promise<string[]> {
  await waitForCustomersListLoaded(page);
  return page.locator('li[data-customer-id]').evaluateAll(
    (items, namePrefix) =>
      items
        .filter((li) => li.textContent.includes(namePrefix))
        .map((li) => li.getAttribute('data-customer-id'))
        .filter((id): id is string => Boolean(id)),
    prefix,
  );
}

export async function cleanupCustomersByPrefix(page: Page, prefix: string) {
  try {
    const ids = new Set<string>();

    await page.goto('/customers');
    for (const id of await collectCustomerIds(page, prefix)) ids.add(id);

    await page
      .getByRole('tab', { name: /archived/i })
      .click()
      .catch(() => undefined);
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
