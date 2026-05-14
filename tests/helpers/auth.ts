import { clerk } from '@clerk/testing/playwright';
import type { Page } from '@playwright/test';

const userAEmail = process.env.CLERK_E2E_USER_A_EMAIL;
const userBEmail = process.env.CLERK_E2E_USER_B_EMAIL;

export const e2eEnvReady = Boolean(
  process.env.CLERK_SECRET_KEY &&
    process.env.CLERK_PUBLISHABLE_KEY &&
    userAEmail &&
    userBEmail &&
    userAEmail !== userBEmail &&
    process.env.DATABASE_URL,
);

export function getE2eEmail(user: 'A' | 'B') {
  const value =
    user === 'A'
      ? process.env.CLERK_E2E_USER_A_EMAIL
      : process.env.CLERK_E2E_USER_B_EMAIL;

  if (!value) {
    throw new Error(`Missing CLERK_E2E_USER_${user}_EMAIL`);
  }

  return value;
}

export async function signInAs(page: Page, user: 'A' | 'B') {
  await page.goto('/sign-in');
  await clerk.signOut({ page }).catch(() => undefined);
  await page.waitForFunction(() => window.Clerk.user === null).catch(() => {
    // Clerk can already be signed out; continue to the sign-in helper.
  });
  await page.goto('/sign-in');
  await clerk.signIn({
    page,
    emailAddress: getE2eEmail(user),
  });
  await page.goto('/customers');
}
