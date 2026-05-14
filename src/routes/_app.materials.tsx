import { Outlet, createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_app/materials')({
  component: MaterialsLayout,
});

function MaterialsLayout() {
  return <Outlet />;
}
