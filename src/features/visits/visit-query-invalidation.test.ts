import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import { invalidateVisitMaterialQueries } from './visit-query-invalidation';
import { visitKeys } from './visit-queries';

describe('invalidateVisitMaterialQueries', () => {
  it('invalidates the material picker and affected unit costs only', async () => {
    const queryClient = new QueryClient();
    const userId = 'user-id';

    queryClient.setQueryData(visitKeys.materials(userId), []);
    queryClient.setQueryData(visitKeys.unitCost(userId, 'material-a'), '1.25');
    queryClient.setQueryData(visitKeys.unitCost(userId, 'material-b'), '2.50');
    queryClient.setQueryData(visitKeys.list(userId), []);

    await invalidateVisitMaterialQueries({
      queryClient,
      userId,
      materialIds: ['material-a', 'material-a', undefined],
    });

    expect(
      queryClient.getQueryState(visitKeys.materials(userId))?.isInvalidated,
    ).toBe(true);
    expect(
      queryClient.getQueryState(visitKeys.unitCost(userId, 'material-a'))
        ?.isInvalidated,
    ).toBe(true);
    expect(
      queryClient.getQueryState(visitKeys.unitCost(userId, 'material-b'))
        ?.isInvalidated,
    ).toBe(false);
    expect(
      queryClient.getQueryState(visitKeys.list(userId))?.isInvalidated,
    ).toBe(false);
  });
});
