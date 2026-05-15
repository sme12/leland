import { createFileRoute } from '@tanstack/react-router';

import { VisitsList } from '#/features/visits/visits-list';

export const Route = createFileRoute('/_app/visits/')({
  component: VisitsList,
});
