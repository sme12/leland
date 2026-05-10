import { clerkMiddleware } from '@clerk/tanstack-react-start/server';
import { createStart } from '@tanstack/react-start';

const clerk = clerkMiddleware();

export const startInstance = createStart(() => {
  return {
    requestMiddleware: [clerk],
  };
});
