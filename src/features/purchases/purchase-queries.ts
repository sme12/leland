export const purchaseKeys = {
  all: (userId: string) => ['purchases', userId] as const,
  list: (userId: string) => [...purchaseKeys.all(userId), 'list'] as const,
  detail: (userId: string, purchaseId: string) =>
    [...purchaseKeys.all(userId), 'detail', purchaseId] as const,
};
