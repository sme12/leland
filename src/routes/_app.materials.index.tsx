import { createFileRoute } from '@tanstack/react-router';

import { MaterialsList } from '#/features/materials/materials-list';

export const Route = createFileRoute('/_app/materials/')({
  component: MaterialsList,
});
