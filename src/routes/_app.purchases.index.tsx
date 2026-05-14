import { createFileRoute } from '@tanstack/react-router';

import { PurchasesList } from '#/features/purchases/purchases-list';

export const Route = createFileRoute('/_app/purchases/')({
  component: PurchasesList,
});
