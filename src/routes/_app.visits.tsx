import { Outlet, createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_app/visits')({
  component: VisitsLayout,
});

function VisitsLayout() {
  return <Outlet />;
}
