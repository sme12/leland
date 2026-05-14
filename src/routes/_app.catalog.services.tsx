import { createFileRoute } from '@tanstack/react-router';

import { ServicePrices } from '#/features/services/service-prices';

export const Route = createFileRoute('/_app/catalog/services')({
  component: ServicePrices,
});
