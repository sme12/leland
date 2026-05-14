import { createFileRoute } from '@tanstack/react-router';

import { CustomersList } from '#/features/customers/customers-list';

export const Route = createFileRoute('/_app/customers/')({
  component: CustomersList,
});
