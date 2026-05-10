import { auth } from '@clerk/tanstack-react-start/server';
import { redirect } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';

export const getAuthState = createServerFn({ method: 'GET' }).handler(
  async () => {
    const { isAuthenticated, userId } = await auth();

    return {
      isAuthenticated,
      userId: userId ?? null,
    };
  },
);

export async function requireAuthenticated() {
  const state = await getAuthState();

  if (!state.isAuthenticated) {
    throw redirect({
      to: '/sign-in',
    });
  }

  return {
    isAuthenticated: true,
    userId: state.userId,
  };
}
