import { auth } from '@clerk/tanstack-react-start/server';
import { redirect } from '@tanstack/react-router';

export async function getServerUserId() {
  const state = await auth();

  return state.userId ?? null;
}

export async function requireServerUserId() {
  const userId = await getServerUserId();

  if (!userId) {
    throw redirect({ to: '/sign-in' });
  }

  return userId;
}
