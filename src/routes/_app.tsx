import { Outlet, createFileRoute } from '@tanstack/react-router';

import { AppProviders } from '#/components/app-providers';
import { authenticateAndBootstrap } from '#/server/bootstrap';

export const Route = createFileRoute('/_app')({
  beforeLoad: () => authenticateAndBootstrap(),
  component: AppLayout,
});

function AppLayout() {
  return (
    <AppProviders>
      <Outlet />
    </AppProviders>
  );
}
