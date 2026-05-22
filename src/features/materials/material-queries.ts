import type { QueryClient } from '@tanstack/react-query';

export type MaterialStatus = 'active' | 'archived';

export const materialKeys = {
  root: ['materials'] as const,
  all: (userId: string) => ['materials', userId] as const,
  list: (userId: string, archived: boolean) =>
    [...materialKeys.all(userId), 'list', { archived }] as const,
  detail: (userId: string, materialId: string) =>
    [...materialKeys.all(userId), 'detail', materialId] as const,
};

/**
 * Invalidate every cached material query. Materials carry derived stock, so a
 * change to a material itself or to a stock-affecting record (a Purchase or a
 * published VisitLineItem) must revalidate all material lists and details.
 */
export function invalidateMaterialQueries(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: materialKeys.root });
}
