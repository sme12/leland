import { createServerFn } from '@tanstack/react-start';

export const authenticateAndBootstrap = createServerFn({
  method: 'POST',
}).handler(async () => {
  const { requireServerUserId } = await import('./auth');
  const { ensureUserBootstrappedForUser } = await import('./bootstrap-core');
  const userId = await requireServerUserId();
  await ensureUserBootstrappedForUser(userId);
  return { isAuthenticated: true as const, userId };
});
