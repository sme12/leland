import type { QueryClient } from '@tanstack/react-query';

import { visitKeys } from './visit-queries';

type MaybeMaterialId = string | null | undefined;

export async function invalidateVisitMaterialQueries({
  queryClient,
  userId,
  materialIds = [],
}: {
  queryClient: QueryClient;
  userId: string;
  materialIds?: Array<MaybeMaterialId>;
}) {
  const uniqueMaterialIds = [...new Set(materialIds.filter(isMaterialId))];

  await Promise.all([
    queryClient.invalidateQueries({ queryKey: visitKeys.materials(userId) }),
    ...uniqueMaterialIds.map((materialId) =>
      queryClient.invalidateQueries({
        queryKey: visitKeys.unitCost(userId, materialId),
      }),
    ),
  ]);
}

function isMaterialId(materialId: MaybeMaterialId): materialId is string {
  return Boolean(materialId);
}
